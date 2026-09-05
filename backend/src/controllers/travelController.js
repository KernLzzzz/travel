/**
 * 旅游规划控制器
 * 处理行程生成（SSE 流式）与快捷提问查询
 */
import { createSSE } from '../utils/sse.js'
import {
  streamItinerary,
  parseItineraryJSON,
  parseSlotJSON,
  normalizeItinerary,
  normalizeSlot,
  generateSpot
} from '../services/travelService.js'
import { guardedStream, hashKey } from '../services/aiGateway.js'
import { QUICK_QUESTIONS } from '../services/chatService.js'
import { ok, ApiError } from '../utils/response.js'

/**
 * 流式生成旅游行程
 * POST /api/travel/recommend
 * body: { city, budget, days, startDate?, travelers?, companion?, pacing?, themes?, preference? }
 */
export async function recommend(req, res) {
  const {
    city, budget, days, startDate, travelers, companion, pacing, themes, preference
  } = req.body || {}

  // 参数校验
  if (!city || typeof city !== 'string') {
    throw new ApiError('请填写目的地城市', 400)
  }
  const budgetNum = Number(budget)
  const daysNum = Number(days)

  if (!Number.isFinite(budgetNum) || budgetNum <= 0) {
    throw new ApiError('预算必须是大于 0 的数字', 400)
  }
  if (!Number.isInteger(daysNum) || daysNum < 1 || daysNum > 15) {
    throw new ApiError('旅行天数必须是 1 到 15 之间的整数', 400)
  }

  // 结构化输入只做轻校验，非法值直接丢弃而不是报错，保证老客户端也能正常调用
  const themesArr = Array.isArray(themes)
    ? themes.filter((t) => typeof t === 'string' && t.trim()).slice(0, 6).map((t) => t.trim())
    : []

  const params = {
    city: city.trim(),
    budget: budgetNum,
    days: daysNum,
    startDate: typeof startDate === 'string' ? startDate.trim().slice(0, 20) : undefined,
    travelers: Number(travelers) || undefined,
    companion: typeof companion === 'string' ? companion.trim().slice(0, 20) : undefined,
    pacing: typeof pacing === 'string' ? pacing.trim().slice(0, 10) : undefined,
    themes: themesArr,
    preference: typeof preference === 'string' ? preference.trim().slice(0, 200) : undefined
  }

  const sse = createSSE(req, res)
  sse.emit('start', { message: '正在生成旅游规划...', traceId: sse.traceId })

  try {
    let rawText = ''

    const stream = guardedStream({
      rateLimitKey: req.userId ? `user:${req.userId}` : `ip:${req.ip}`,
      // 缓存键包含全部输入，保证同参数命中、不同参数隔离
      cacheKey: `itinerary:${hashKey(JSON.stringify(params))}`,
      traceId: sse.traceId,
      call: () => streamItinerary(params),
      onComplete: (text) => {
        rawText = text
      }
    })

    for await (const chunk of stream) {
      // 客户端已断开则停止读取，不再消耗模型 token
      if (sse.closed) break
      sse.chunk(chunk)
    }

    if (sse.closed) return

    // 解析并规范化结果
    const parsed = parseItineraryJSON(rawText)
    if (!parsed) {
      sse.error('模型返回内容无法解析为有效行程，请重试')
      return
    }

    const itinerary = normalizeItinerary(parsed, params)
    sse.done({ itinerary })
  } catch (err) {
    if (!sse.closed) {
      sse.error(err?.message || '生成失败，请稍后重试')
    }
  }
}

/**
 * 获取热门城市与快捷提问（供前端首页渲染）
 * GET /api/travel/meta
 */
export function getMeta(req, res) {
  ok(res, {
    hotCities: [
      '北京', '上海', '广州', '深圳', '成都', '杭州', '西安', '重庆',
      '南京', '武汉', '苏州', '长沙', '天津', '青岛', '厦门', '三亚',
      '昆明', '桂林', '丽江', '大理', '哈尔滨', '拉萨', '乌鲁木齐'
    ],
    quickQuestions: QUICK_QUESTIONS
  })
}

/**
 * 单景点重生成（换一个）
 * POST /api/travel/swap
 * body: { city, day, period, current, days?, theme?, budget?, companion?, themes?, preference? }
 * 返回一个与当前安排类型错开的新时段数据
 */
export async function swapSpot(req, res) {
  const {
    city, day, period, current, days, theme, budget, companion, themes, preference, avoidSpots
  } = req.body || {}

  if (!city || typeof city !== 'string') {
    throw new ApiError('缺少目的地城市信息', 400)
  }
  if (!current || typeof current !== 'object' || !current.spot) {
    throw new ApiError('缺少当前景点信息', 400)
  }
  if (!['morning', 'afternoon', 'evening'].includes(period)) {
    throw new ApiError('时段参数不正确', 400)
  }
  const dayNum = Number(day)
  if (!Number.isInteger(dayNum) || dayNum < 1 || dayNum > 15) {
    throw new ApiError('天数参数不正确', 400)
  }

  const params = {
    city: city.trim(),
    day: dayNum,
    period,
    current: {
      spot: String(current.spot).slice(0, 60),
      description: typeof current.description === 'string' ? current.description.slice(0, 120) : ''
    },
    days: Number(days) || undefined,
    theme: typeof theme === 'string' ? theme.trim().slice(0, 40) : undefined,
    budget: Number(budget) || undefined,
    companion: typeof companion === 'string' ? companion.trim().slice(0, 20) : undefined,
    themes: Array.isArray(themes)
      ? themes.filter((t) => typeof t === 'string' && t.trim()).slice(0, 6).map((t) => t.trim())
      : undefined,
    preference: typeof preference === 'string' ? preference.trim().slice(0, 200) : undefined,
    avoidSpots: Array.isArray(avoidSpots)
      ? avoidSpots.filter((s) => typeof s === 'string' && s.trim()).slice(0, 15).map((s) => s.trim().slice(0, 40))
      : undefined
  }

  // 注意：这里刻意不启用缓存——同一个景点连点「换一个」应该给出不同结果
  const stream = guardedStream({
    rateLimitKey: req.userId ? `user:${req.userId}` : `ip:${req.ip}`,
    cacheKey: null,
    traceId: `swap-${req.userId || req.ip}`,
    call: () => generateSpot(params)
  })

  let full = ''
  for await (const chunk of stream) {
    full += chunk
  }

  if (!full) {
    throw new ApiError('生成失败，请稍后重试', 502)
  }

  const slot = normalizeSlot(parseSlotJSON(full))
  if (!slot.spot || slot.spot === '自由安排') {
    throw new ApiError('模型返回内容无法解析，请重试', 502)
  }

  ok(res, { slot }, '已为你换了一个新去处')
}

export default { recommend, getMeta, swapSpot }
