/**
 * SSE 流式读取工具
 *
 * 为什么不用 Axios / EventSource？
 * - EventSource 只支持 GET，且无法自定义请求头（带不了 Token）
 * - Axios 不支持读取流式响应体
 * 因此使用 Fetch API + ReadableStream 手动解析 SSE 协议
 */

/**
 * 读取 SSE 流
 * @param {object} options
 * @param {string} options.url 请求地址（相对路径，如 /api/travel/recommend）
 * @param {object} [options.body] POST 请求体
 * @param {string} [options.token] 鉴权 Token
 * @param {(event: string, data: any) => void} options.onEvent 事件回调
 * @param {AbortSignal} [options.signal] 中断信号
 * @returns {Promise<{event: string, data: any}>} 最终 done/error 事件
 */
export async function readSSE({ url, body, token, onEvent, signal }) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body || {}),
    signal
  })

  // 非 SSE 响应（如参数校验失败返回的 JSON 错误）统一抛出
  if (!res.ok || !res.body) {
    let message = `请求失败（HTTP ${res.status}）`
    try {
      const json = await res.json()
      message = json?.message || message
    } catch {
      // 响应体不是 JSON 时保留默认提示
    }
    throw new Error(message)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let final = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // SSE 帧之间以空行分隔，逐帧解析
    const frames = buffer.split('\n\n')
    buffer = frames.pop() || ''

    for (const frame of frames) {
      const eventLine = frame.split('\n').find((l) => l.startsWith('event: '))
      const dataLine = frame.split('\n').find((l) => l.startsWith('data: '))
      if (!dataLine) continue

      const event = eventLine ? eventLine.slice(7).trim() : 'message'
      let data = null
      try {
        data = JSON.parse(dataLine.slice(6))
      } catch {
        continue
      }

      if (event === 'done' || event === 'error') {
        final = { event, data }
      }
      onEvent?.(event, data)
    }
  }

  return final
}

/**
 * 创建中断控制器，供组件在销毁或重试时中止流式请求
 * @returns {{controller: AbortController, abort: () => void}}
 */
export function createAborter() {
  const controller = new AbortController()
  return {
    controller,
    abort: () => controller.abort(),
    get signal() {
      return controller.signal
    }
  }
}

/* ================= 增量 JSON 解析器 =================
 * 用于「渐进式渲染」：模型流式输出的是一段尚未完整的 JSON，
 * 这里实时从中提取「已经完整」的部分，让行程卡片逐张出现。
 * 核心难点：字符串内的括号不计入嵌套深度，且要处理转义字符。
 */

/**
 * 扫描文本，提取从 from 位置开始的所有「完整」顶层对象
 * @param {string} text 部分 JSON 文本
 * @param {number} from 起始下标
 * @returns {Array<object>} 已完整的对象列表
 */
function extractCompleteObjects(text, from) {
  const objects = []
  let depth = 0
  let inStr = false
  let esc = false
  let objStart = -1

  for (let i = from; i < text.length; i++) {
    const ch = text[i]

    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }

    if (ch === '"') {
      inStr = true
      continue
    }
    if (ch === '{') {
      if (depth === 0) objStart = i
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 0 && objStart >= 0) {
        const raw = text.slice(objStart, i + 1)
        try {
          objects.push(JSON.parse(raw))
        } catch {
          // 对象不完整（如字符串截断），跳过等待下一批数据
        }
        objStart = -1
      }
    } else if (ch === ']' && depth === 0) {
      break
    }
  }
  return objects
}

/**
 * 从流式 JSON 文本中提取当前已完整的行程片段
 * @param {string} text 到目前为止收到的全部文本
 * @returns {{city?: string, days?: number, totalBudget?: number, summary?: string,
 *            dailyItinerary: Array, budgetBreakdown?: object}}
 */
export function extractPartialItinerary(text) {
  const result = { dailyItinerary: [] }
  if (!text) return result

  // 提取已完整的字符串字段
  for (const key of ['city', 'summary']) {
    const m = text.match(new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`))
    if (m) {
      try {
        result[key] = JSON.parse(`"${m[1]}"`)
      } catch {
        // 字段不完整，跳过
      }
    }
  }

  // 提取已完整的数字字段
  for (const key of ['days', 'totalBudget']) {
    const m = text.match(new RegExp(`"${key}"\\s*:\\s*(\\d+)`))
    if (m) result[key] = Number(m[1])
  }

  // 提取 dailyItinerary 数组中已完整的「天」对象
  const arrIdx = text.search(/"dailyItinerary"\s*:\s*\[/)
  if (arrIdx >= 0) {
    const start = text.indexOf('[', arrIdx)
    if (start >= 0) {
      result.dailyItinerary = extractCompleteObjects(text, start + 1)
    }
  }

  // 提取已完整的 budgetBreakdown 对象
  const bIdx = text.search(/"budgetBreakdown"\s*:\s*\{/)
  if (bIdx >= 0) {
    const start = text.indexOf('{', bIdx)
    const objs = extractCompleteObjects(text, start)
    if (objs.length > 0) result.budgetBreakdown = objs[0]
  }

  return result
}

export default { readSSE, createAborter, extractPartialItinerary }
