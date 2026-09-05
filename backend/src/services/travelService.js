/**
 * 旅游行程规划服务
 * 负责构建提示词、调用大模型、解析并校验返回的结构化数据
 */
import { streamChat, isMock } from './llm.js'

/** 系统提示词：约束模型角色与输出格式 */
const SYSTEM_PROMPT = `你是一位经验丰富的专业旅游规划师，擅长根据用户的预算和时间约束，规划出真正可执行的行程。

你的输出必须严格遵循以下要求：
1. 只输出 JSON，不要有任何解释性文字、不要使用 Markdown 代码块标记
2. JSON 必须可被标准 JSON.parse 解析
3. 所有金额字段为纯数字，不要带「元」「¥」等符号
4. 行程要具体可执行：写明建议出发时间、游览时长、具体交通方式
5. 门票价格与交通费用要符合该城市实际水平，不要编造离谱数字`

/**
 * 构建用户提示词
 * 除城市/预算/天数外，还吸收出发日期、同行人、节奏、兴趣主题等结构化输入，
 * 让模型拿到的时间与人群信号足够具体，而不是靠猜
 * @param {{city:string, budget:number, days:number, startDate?:string,
 *          travelers?:number, companion?:string, pacing?:string,
 *          themes?:string[], preference?:string}} params
 * @returns {string}
 */
function buildUserPrompt({
  city, budget, days, startDate, travelers, companion, pacing, themes, preference
}) {
  // 把结构化输入逐条拼进提示词，空值直接跳过对应行
  const lines = [
    `- 目的地城市：${city}`,
    `- 总预算：${budget} 元（含住宿、餐饮、市内交通、门票，不含往返大交通）`,
    `- 旅行天数：${days} 天`
  ]

  if (startDate) {
    lines.push(`- 出发日期：${startDate}（请结合当季天气、节假日人流与应季体验来安排）`)
  }
  if (companion) {
    lines.push(`- 同行人：${companion}${Number(travelers) > 1 ? `，共 ${travelers} 人` : ''}（安排要符合该人群的体力与兴趣特点）`)
  }
  if (pacing) {
    lines.push(`- 行程节奏：${pacing}`)
  }
  if (Array.isArray(themes) && themes.length) {
    lines.push(`- 兴趣主题：${themes.join('、')}（优先安排与主题匹配的地点）`)
  }
  if (preference) {
    lines.push(`- 补充要求：${preference}`)
  }

  return `请为我规划一份旅游行程，要求如下：

${lines.join('\n')}

请按下面的 JSON 结构输出：
{
  "city": "城市名",
  "days": ${days},
  "totalBudget": ${budget},
  "summary": "一句话行程总览",
  "dailyItinerary": [
    {
      "day": 1,
      "date": "第1天",
      "theme": "当日主题，例如：皇城经典线",
      "morning":   { "spot": "景点名称", "duration": "游览时长", "ticket": "门票价格", "transportation": "交通方式", "description": "景点介绍" },
      "afternoon": { "spot": "景点名称", "duration": "游览时长", "ticket": "门票价格", "transportation": "交通方式", "description": "景点介绍" },
      "evening":   { "spot": "活动名称", "duration": "活动时长", "ticket": "费用",     "transportation": "交通方式", "description": "活动介绍" }
    }
  ],
  "budgetBreakdown": {
    "accommodation": 住宿费用数字,
    "food": 餐饮费用数字,
    "transportation": 交通费用数字,
    "tickets": 门票费用数字,
    "other": 其他费用数字
  },
  "tips": ["实用提示1", "实用提示2", "实用提示3"],
  "warnings": ["注意事项1", "注意事项2"]
}

硬性约束：budgetBreakdown 中各项之和必须等于 totalBudget（${budget}），请自行核算准确。`
}

/**
 * 从模型输出中提取 JSON
 * 模型经常在 JSON 外包裹 Markdown 代码块或前言后语，这里做三重容错
 * @param {string} text 模型原始输出
 * @returns {object|null} 解析成功返回对象，失败返回 null
 */
export function parseItineraryJSON(text) {
  if (!text || typeof text !== 'string') return null

  const candidates = [
    // 情形一：```json ... ```
    text.match(/```json\s*([\s\S]*?)```/)?.[1],
    // 情形二：``` ... ```（未标注语言）
    text.match(/```\s*([\s\S]*?)```/)?.[1],
    // 情形三：裸 JSON，取第一个 { 到最后一个 }
    text.match(/\{[\s\S]*\}/)?.[0]
  ]

  for (const candidate of candidates) {
    if (!candidate) continue
    try {
      return JSON.parse(candidate.trim())
    } catch {
      // 该候选解析失败，继续尝试下一个
    }
  }

  return null
}

/** 解析单个时段数据的别名，语义上与行程整体解析区分开 */
export function parseSlotJSON(text) {
  return parseItineraryJSON(text)
}

/**
 * 校验并修复行程数据
 * 补齐缺失字段、统一数值类型、修正预算加总
 * @param {object} raw 模型解析出的原始数据
 * @param {{city:string, budget:number, days:number}} params 用户原始输入
 * @returns {object} 规范化后的行程数据
 */
export function normalizeItinerary(raw, params) {
  const { city, budget, days } = params

  // 兜底：缺失的时段用占位内容补齐，避免前端渲染时报错
  const emptySlot = (fallback) => ({
    spot: fallback,
    duration: '待定',
    ticket: '待定',
    transportation: '待定',
    description: '暂无安排，可根据实际情况自由调整'
  })

  const rawDays = Array.isArray(raw?.dailyItinerary) ? raw.dailyItinerary : []

  const dailyItinerary = Array.from({ length: days }, (_, i) => {
    const day = rawDays[i] || {}
    return {
      day: i + 1,
      date: day.date || `第${i + 1}天`,
      theme: day.theme || `第${i + 1}天行程`,
      morning: day.morning || emptySlot('自由安排'),
      afternoon: day.afternoon || emptySlot('自由安排'),
      evening: day.evening || emptySlot('自由活动')
    }
  })

  // 预算：字段缺失按 0 处理，并强制转为数字
  const breakdown = {
    accommodation: Number(raw?.budgetBreakdown?.accommodation) || 0,
    food: Number(raw?.budgetBreakdown?.food) || 0,
    transportation: Number(raw?.budgetBreakdown?.transportation) || 0,
    tickets: Number(raw?.budgetBreakdown?.tickets) || 0,
    other: Number(raw?.budgetBreakdown?.other) || 0
  }

  // 预算校验：模型给出的加总往往与用户预算不符
  const sum = Object.values(breakdown).reduce((a, b) => a + b, 0)
  let budgetMatched = true

  if (sum > 0 && Math.abs(sum - budget) > 1) {
    // 按比例缩放各项，使加总严格等于用户预算
    const ratio = budget / sum
    let allocated = 0
    const keys = Object.keys(breakdown)
    keys.forEach((key, idx) => {
      if (idx === keys.length - 1) {
        breakdown[key] = budget - allocated
      } else {
        breakdown[key] = Math.round(breakdown[key] * ratio)
        allocated += breakdown[key]
      }
    })
    budgetMatched = false
  } else if (sum === 0) {
    // 模型完全没给预算，按经验比例分配
    breakdown.accommodation = Math.round(budget * 0.35)
    breakdown.food = Math.round(budget * 0.25)
    breakdown.transportation = Math.round(budget * 0.15)
    breakdown.tickets = Math.round(budget * 0.15)
    breakdown.other = budget - breakdown.accommodation - breakdown.food - breakdown.transportation - breakdown.tickets
    budgetMatched = false
  }

  return {
    city: raw?.city || city,
    days,
    totalBudget: budget,
    summary: raw?.summary || `${city}${days}日游，预算 ${budget} 元`,
    dailyItinerary,
    budgetBreakdown: breakdown,
    budgetMatched,
    tips: Array.isArray(raw?.tips) ? raw.tips : ['建议提前预订住宿与热门景点门票'],
    warnings: Array.isArray(raw?.warnings) ? raw.warnings : ['行程仅供参考，出行前请确认景点开放时间']
  }
}

/**
 * 生成 Mock 行程（无 API Key 时使用）
 * 保证前端能拿到一份结构完整、可直接渲染的数据
 * @param {{city:string, budget:number, days:number}} params
 * @returns {object}
 */
function buildMockItinerary({ city, budget, days }) {
  const spots = ['城市博物馆', '历史老街', '标志性公园', '特色美食街', '文化广场', '滨江风光带']

  const dailyItinerary = Array.from({ length: days }, (_, i) => ({
    day: i + 1,
    date: `第${i + 1}天`,
    theme: `第${i + 1}天：经典路线`,
    morning: {
      spot: `${spots[(i * 3) % spots.length]}`,
      duration: '约 3 小时',
      ticket: '约 60 元',
      transportation: '地铁或公交直达',
      description: `这是${city}极具代表性的上午去处，建议早点出发避开人流高峰。`
    },
    afternoon: {
      spot: `${spots[(i * 3 + 1) % spots.length]}`,
      duration: '约 4 小时',
      ticket: '约 80 元',
      transportation: '打车约 20 分钟',
      description: `午饭后步行即可到达，是${city}本地人也常去的地方，适合慢慢逛。`
    },
    evening: {
      spot: `${spots[(i * 3 + 2) % spots.length]}`,
      duration: '约 2 小时',
      ticket: '免费',
      transportation: '步行可达',
      description: '夜晚灯光效果好，适合散步和品尝当地小吃。'
    }
  }))

  const breakdown = {
    accommodation: Math.round(budget * 0.35),
    food: Math.round(budget * 0.25),
    transportation: Math.round(budget * 0.15),
    tickets: Math.round(budget * 0.15),
    other: 0
  }
  breakdown.other = budget - breakdown.accommodation - breakdown.food - breakdown.transportation - breakdown.tickets

  return {
    city,
    days,
    totalBudget: budget,
    summary: `${city}${days}日经典行程，兼顾自然风光与人文体验`,
    dailyItinerary,
    budgetBreakdown: breakdown,
    budgetMatched: true,
    tips: [
      '热门景点建议提前一天在线预约，避免现场排队',
      '下载当地地铁 App，市内出行更省心',
      '随身携带充电宝与常用药品'
    ],
    warnings: ['本行程为模拟数据，仅供功能演示', '出行前请核实景点开放时间与门票价格']
  }
}

/**
 * 流式生成旅游行程
 * @param {{city:string, budget:number, days:number, preference?:string}} params
 * @yields {string} 模型逐段输出的原始文本
 */
export async function* streamItinerary(params) {
  const userPrompt = buildUserPrompt(params)

  // Mock 模式：把完整 JSON 作为流式文本输出，前端解析逻辑与真实模式完全一致
  const mockText = isMock() ? JSON.stringify(buildMockItinerary(params), null, 2) : undefined

  yield* streamChat({
    system: SYSTEM_PROMPT,
    user: userPrompt,
    mockText
  })
}

/* ==================== 单景点重生成（换一个） ==================== */

const SWAP_SYSTEM_PROMPT = `你是一位经验丰富的专业旅游规划师。用户对行程中的某个时段不满意，需要你推荐一个替代去处。

输出要求：
1. 只输出一个 JSON 对象，不要有任何解释性文字，不要使用 Markdown 代码块标记
2. JSON 必须可被标准 JSON.parse 解析
3. 门票与交通信息要符合当地实际水平，不要编造离谱数字`

/**
 * 构建换一个景点的用户提示词
 * 明确要求与当前安排类型错开，避免「换了一个差不多的」
 */
function buildSwapPrompt({ city, day, theme, period, current, days, companion, themes, preference, avoidSpots }) {
  const periodLabel = { morning: '上午', afternoon: '下午', evening: '晚上' }[period] || '该时段'
  const lines = [
    `我在「${city}」${days ? `${days} 日游` : ''}行程的第 ${day} 天${periodLabel}，当前安排是：`,
    `- 地点：${current?.spot || '未指定'}`,
    `- 类型：${current?.description ? current.description.slice(0, 40) : '未知'}`,
    theme ? `- 当日主题：${theme}` : '',
    companion ? `- 同行人：${companion}` : '',
    Array.isArray(themes) && themes.length ? `- 兴趣主题：${themes.join('、')}` : '',
    preference ? `- 补充要求：${preference}` : ''
  ].filter(Boolean)

  // 行程里其他时段已有的安排，明确要求避开，防止「换一个」换出重复地点
  if (Array.isArray(avoidSpots) && avoidSpots.length) {
    lines.push(`- 行程中其他时段已安排（必须避开这些地点）：${avoidSpots.slice(0, 15).join('、')}`)
  }

  return `${lines.join('\n')}

请为这个时段推荐一个新的去处，要求：
1. 与当前安排的类型明显不同（当前是博物馆就换户外，当前是自然风光就换人文街区，以此类推）
2. 与当日主题、同行人特点匹配，且与行程中其他时段不会明显重复
3. 游览时长控制在${period === 'evening' ? '1-3 小时（夜间活动）' : '2-5 小时'}

只输出如下 JSON：
{"spot":"地点名称","duration":"建议游览时长","ticket":"门票价格","transportation":"交通方式","description":"30-60 字的介绍，说明它适合这个时段的理由"}`
}

/** 兜底字段，保证时段结构完整，前端渲染不报错 */
export function normalizeSlot(slot, fallbackName = '自由安排') {
  return {
    spot: slot?.spot || fallbackName,
    duration: slot?.duration || '待定',
    ticket: slot?.ticket || '待定',
    transportation: slot?.transportation || '待定',
    description: slot?.description || '暂无介绍，可根据实际情况自由调整'
  }
}

/** Mock 模式下的替代景点，避免无 Key 时功能完全不可用 */
const MOCK_SWAPS = [
  { spot: '城市艺术街区', duration: '约 2.5 小时', ticket: '免费', transportation: '地铁 2 站直达', description: '本地创意小店与街头涂鸦聚集地，节奏轻松，适合随便逛逛拍拍照。' },
  { spot: '江滨绿道骑行', duration: '约 3 小时', ticket: '免费', transportation: '打车约 15 分钟', description: '沿江骑行道风景开阔，傍晚光线柔和，适合想动一动又不想太累的安排。' },
  { spot: '老城茶馆听曲', duration: '约 1.5 小时', ticket: '约 40 元含茶水', transportation: '步行可达', description: '老字号茶馆有本地曲艺表演，坐下来慢慢听，正好避开正午或夜晚的高峰人流。' }
]

/**
 * 生成单个时段的替代安排
 * 实现为异步生成器（而非返回 Promise），以便直接接入 AI 网关的流式管道
 * @param {object} params 换景点上下文
 * @yields {string} 模型输出的文本片段
 */
export async function* generateSpot(params) {
  // Mock 模式：轮换返回预置数据，保证可演示
  if (isMock()) {
    const idx = Math.floor(Math.random() * MOCK_SWAPS.length)
    yield JSON.stringify(normalizeSlot(MOCK_SWAPS[idx]))
    return
  }

  yield* streamChat({
    system: SWAP_SYSTEM_PROMPT,
    user: buildSwapPrompt(params)
  })
}

export default {
  streamItinerary, parseItineraryJSON, normalizeItinerary, generateSpot, normalizeSlot, parseSlotJSON
}
