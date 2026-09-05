/**
 * AI 网关层
 *
 * 大模型接口有三个致命特点：慢、贵、不稳定。
 * 直接在业务代码里调用模型，会导致：
 *   - 请求堆积拖垮服务（无并发控制）
 *   - 模型卡住时连接永不释放（无超时）
 *   - 被脚本刷接口烧掉大量 token（无限流）
 *   - 相同问题反复付费调用（无缓存）
 *
 * 本模块用「信号量 + 令牌桶 + 超时熔断 + LRU 缓存」四件套统一解决，
 * 并对外暴露运行时指标，实现基本的可观测性。
 */
import crypto from 'node:crypto'

/** 网关参数（后续可迁移到配置文件） */
const GATEWAY_CONFIG = {
  /** 同时最多允许多少个模型调用，防止并发打满 */
  maxConcurrency: Number(process.env.AI_MAX_CONCURRENCY) || 5,
  /** 单次调用总时长上限 */
  timeoutMs: Number(process.env.AI_TIMEOUT_MS) || 120000,
  /** 单个数据块最长等待时间，超过视为模型卡住 */
  stallMs: Number(process.env.AI_STALL_MS) || 30000,
  /** 限流：令牌桶容量 */
  bucketCapacity: Number(process.env.AI_RATE_CAPACITY) || 10,
  /** 限流：每秒补充的令牌数（1/6 表示约 6 秒恢复 1 次调用额度） */
  bucketRefillPerSec: Number(process.env.AI_RATE_REFILL) || 1 / 6,
  /** 缓存条目上限 */
  cacheMax: Number(process.env.AI_CACHE_MAX) || 100,
  /** 缓存有效期 */
  cacheTtlMs: Number(process.env.AI_CACHE_TTL_MS) || 10 * 60 * 1000
}

/* ==================== 运行时指标 ==================== */

const metrics = {
  totalRequests: 0,
  successCount: 0,
  failureCount: 0,
  cacheHits: 0,
  rateLimitedCount: 0,
  timeoutCount: 0,
  concurrencyRejectedCount: 0,
  totalLatencyMs: 0,
  activeCount: 0,
  startedAt: Date.now()
}

/** 获取运行时指标快照 */
export function getMetrics() {
  const avgLatency = metrics.successCount > 0 ? Math.round(metrics.totalLatencyMs / metrics.successCount) : 0
  return {
    ...metrics,
    avgLatencyMs: avgLatency,
    uptimeSec: Math.round((Date.now() - metrics.startedAt) / 1000),
    config: {
      maxConcurrency: GATEWAY_CONFIG.maxConcurrency,
      timeoutMs: GATEWAY_CONFIG.timeoutMs,
      cacheMax: GATEWAY_CONFIG.cacheMax
    }
  }
}

/* ==================== 信号量：并发控制 ==================== */

class Semaphore {
  constructor(max) {
    this.max = max
    this.active = 0
    this.waiting = []
  }

  /** 获取一个许可，超出并发数时进入等待队列 */
  acquire() {
    if (this.active < this.max) {
      this.active += 1
      return Promise.resolve(true)
    }
    return new Promise((resolve) => this.waiting.push(resolve))
  }

  /** 释放许可，唤醒队首等待者 */
  release() {
    this.active -= 1
    if (this.waiting.length > 0) {
      const next = this.waiting.shift()
      this.active += 1
      next(true)
    }
  }

  /** 尝试立即获取，不等待。用于快速失败，避免请求无限堆积 */
  tryAcquire() {
    if (this.active < this.max) {
      this.active += 1
      return true
    }
    return false
  }
}

const semaphore = new Semaphore(GATEWAY_CONFIG.maxConcurrency)

/* ==================== 令牌桶：按用户限流 ==================== */

class TokenBucket {
  constructor(capacity, refillPerSec) {
    this.capacity = capacity
    this.refillPerSec = refillPerSec
    this.buckets = new Map()
  }

  /**
   * 尝试消费一个令牌
   * @param {string} key 通常为 userId 或 IP
   * @returns {{allowed: boolean, retryAfterSec: number}}
   */
  consume(key) {
    const now = Date.now()
    const bucket = this.buckets.get(key) || { tokens: this.capacity, lastRefill: now }

    // 按时间比例补充令牌
    const elapsedSec = (now - bucket.lastRefill) / 1000
    bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsedSec * this.refillPerSec)
    bucket.lastRefill = now

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1
      this.buckets.set(key, bucket)
      return { allowed: true, retryAfterSec: 0 }
    }

    this.buckets.set(key, bucket)
    const waitSec = Math.ceil((1 - bucket.tokens) / this.refillPerSec)
    return { allowed: false, retryAfterSec: waitSec }
  }
}

const rateLimiter = new TokenBucket(GATEWAY_CONFIG.bucketCapacity, GATEWAY_CONFIG.bucketRefillPerSec)

/* ==================== LRU 缓存：避免重复付费调用 ==================== */

class LRUCache {
  constructor(max, ttlMs) {
    this.max = max
    this.ttlMs = ttlMs
    this.map = new Map()
  }

  get(key) {
    const hit = this.map.get(key)
    if (!hit) return null

    // 过期则删除
    if (Date.now() > hit.expiresAt) {
      this.map.delete(key)
      return null
    }

    // 命中后移到队尾，维持 LRU 顺序
    this.map.delete(key)
    this.map.set(key, hit)
    return hit.value
  }

  set(key, value) {
    if (this.map.has(key)) this.map.delete(key)

    // 超出容量时淘汰最久未使用的条目
    if (this.map.size >= this.max) {
      const oldestKey = this.map.keys().next().value
      this.map.delete(oldestKey)
    }

    this.map.set(key, { value, expiresAt: Date.now() + this.ttlMs })
  }

  get size() {
    return this.map.size
  }
}

const cache = new LRUCache(GATEWAY_CONFIG.cacheMax, GATEWAY_CONFIG.cacheTtlMs)

/* ==================== 超时控制 ==================== */

/**
 * 为迭代器的每次 next() 加上单次等待上限
 * @param {AsyncIterator} iterator
 * @param {number} ms
 * @param {string} message
 */
function nextWithTimeout(iterator, ms, message) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms)
  })

  return Promise.race([iterator.next(), timeout]).finally(() => clearTimeout(timer))
}

/* ==================== 对外主入口 ==================== */

/** 网关异常类，携带可映射的 HTTP 状态码 */
export class GatewayError extends Error {
  constructor(message, code = 500, retryAfterSec = 0) {
    super(message)
    this.name = 'GatewayError'
    this.code = code
    this.retryAfterSec = retryAfterSec
  }
}

/**
 * 计算字符串哈希，用作缓存键
 * @param {string} str
 * @returns {string}
 */
export function hashKey(str) {
  return crypto.createHash('md5').update(str).digest('hex')
}

/**
 * 经过网关保护的流式调用
 *
 * 完整链路：限流 → 并发控制 → 查缓存 → 调模型（带超时）→ 写缓存
 *
 * @param {object} options
 * @param {string} options.rateLimitKey 限流维度（用户ID 或 IP）
 * @param {string} options.cacheKey 缓存键（为空表示不缓存）
 * @param {string} [options.traceId] 追踪 ID
 * @param {() => AsyncGenerator<string>} options.call 真正的模型调用，返回异步生成器
 * @param {(text: string) => void} [options.onComplete] 完整文本回调
 * @yields {string} 逐段文本内容
 */
export async function* guardedStream({ rateLimitKey, cacheKey, traceId = '-', call, onComplete }) {
  const startTime = Date.now()
  metrics.totalRequests += 1

  // 第一步：限流，防止刷接口
  const { allowed, retryAfterSec } = rateLimiter.consume(rateLimitKey || 'anonymous')
  if (!allowed) {
    metrics.rateLimitedCount += 1
    throw new GatewayError(`请求过于频繁，请 ${retryAfterSec} 秒后再试`, 429, retryAfterSec)
  }

  // 第二步：并发控制，快速失败而不是无限堆积
  const acquired = semaphore.tryAcquire()
  if (!acquired) {
    metrics.concurrencyRejectedCount += 1
    throw new GatewayError('当前生成请求过多，请稍后再试', 503)
  }

  metrics.activeCount += 1

  try {
    // 第三步：缓存命中，直接把缓存内容以流式方式吐出
    // 这样即使命中缓存，前端依然保持逐字渲染的体验
    if (cacheKey) {
      const cached = cache.get(cacheKey)
      if (cached) {
        metrics.cacheHits += 1
        console.log(`[AI][${traceId}] 缓存命中，跳过模型调用`)
        const step = 24
        for (let i = 0; i < cached.length; i += step) {
          await new Promise((r) => setTimeout(r, 12))
          yield cached.slice(i, i + step)
        }
        metrics.successCount += 1
        metrics.totalLatencyMs += Date.now() - startTime
        onComplete?.(cached)
        return
      }
    }

    // 第四步：真实调用模型，全程受总时长与单块等待时长双重约束
    const iterator = call()[Symbol.asyncIterator]()
    const deadline = Date.now() + GATEWAY_CONFIG.timeoutMs
    let full = ''

    try {
      while (true) {
        if (Date.now() > deadline) {
          metrics.timeoutCount += 1
          throw new Error(`生成超时（超过 ${GATEWAY_CONFIG.timeoutMs / 1000} 秒）`)
        }

        const remainStall = Math.min(GATEWAY_CONFIG.stallMs, deadline - Date.now())
        const { value, done } = await nextWithTimeout(iterator, remainStall, '模型响应中断，长时间未返回数据')

        if (done) break
        if (value) {
          full += value
          yield value
        }
      }
    } finally {
      // 无论正常结束还是异常中断，都要关闭底层迭代器，释放模型连接
      if (typeof iterator.return === 'function') {
        await iterator.return?.().catch(() => {})
      }
    }

    // 第五步：写入缓存，下次相同问题直接命中
    if (cacheKey && full) {
      cache.set(cacheKey, full)
    }

    metrics.successCount += 1
    metrics.totalLatencyMs += Date.now() - startTime
    console.log(`[AI][${traceId}] 生成完成，耗时 ${Date.now() - startTime}ms，字符数 ${full.length}`)

    onComplete?.(full)
  } catch (err) {
    metrics.failureCount += 1

    // 网关自身抛出的错误保持原样，其余包装为 502
    if (err instanceof GatewayError) throw err
    if (err?.message?.includes('超时') || err?.message?.includes('中断')) {
      throw new GatewayError(err.message, 504)
    }
    throw new GatewayError(err?.message || '模型调用失败', 502)
  } finally {
    metrics.activeCount -= 1
    semaphore.release()
  }
}

export default { guardedStream, getMetrics, hashKey, GatewayError }
