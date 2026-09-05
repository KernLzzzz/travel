/**
 * AI 旅游问答服务
 * 支持多轮对话：每次请求携带历史消息，让模型理解上下文
 */
import { streamChat } from './llm.js'

/** 对话系统提示词 */
const SYSTEM_PROMPT = `你是「智能旅游助手」，一位专业、友好、务实的旅游顾问。

你的回答风格：
1. 直接给结论，再补充理由，不要铺垫废话
2. 涉及价格、时间、交通时给出具体参考值，并提示"以实际为准"
3. 遇到你不确定的实时信息（如某景点今日开放状态），明确说明无法确认，不要编造
4. 回答使用中文，条理清晰，必要时分点说明
5. 如果用户的问题与旅游无关，礼貌地引导回旅游话题`

/** 首页快捷提问，前端可直接取用 */
export const QUICK_QUESTIONS = [
  '北京有哪些必去的景点？',
  '上海三日游怎么安排最合理？',
  '成都的特色美食推荐',
  '出门旅行如何买保险？',
  '带老人出行需要注意什么？',
  '国内适合亲子游的目的地'
]

/** 触发行程规划的关键词 */
const PLAN_KEYWORDS = ['规划', '安排', '攻略', '行程', '计划', '怎么玩', '去哪玩', '几日游', '日游']

/** 支持识别的城市清单 */
const CITIES = [
  '北京', '上海', '广州', '深圳', '成都', '杭州', '西安', '重庆',
  '南京', '武汉', '苏州', '长沙', '天津', '郑州', '济南', '青岛',
  '大连', '沈阳', '哈尔滨', '长春', '福州', '厦门', '南昌', '合肥',
  '昆明', '贵阳', '南宁', '桂林', '海口', '三亚', '丽江', '大理',
  '兰州', '乌鲁木齐', '拉萨', '呼和浩特', '太原', '石家庄'
]

/** 中文数字映射 */
const CN_NUM = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 }

/**
 * 识别用户消息中的行程规划意图
 * 命中条件：包含规划关键词 + 包含城市名
 * @param {string} text 用户消息
 * @returns {{city: string, days: number, budget: number}|null}
 */
export function detectPlanIntent(text) {
  if (!text || typeof text !== 'string') return null

  const hasKeyword = PLAN_KEYWORDS.some((k) => text.includes(k))
  if (!hasKeyword) return null

  const city = CITIES.find((c) => text.includes(c))
  if (!city) return null

  // 提取天数：支持阿拉伯数字与中文数字，默认 3 天
  let days = 3
  const daysMatch = text.match(/([0-9一二两三四五六七八九十]+)\s*[天日]/)
  if (daysMatch) {
    const raw = daysMatch[1]
    days = /^[0-9]+$/.test(raw) ? Number(raw) : CN_NUM[raw] || 3
  }
  days = Math.min(15, Math.max(1, days))

  // 提取预算：3~6 位数字，默认 3000 元
  let budget = 3000
  const budgetMatch = text.match(/预算\s*([0-9]{3,6})|([0-9]{3,6})\s*元/)
  if (budgetMatch) {
    budget = Number(budgetMatch[1] || budgetMatch[2])
  }

  return { city, days, budget }
}

/**
 * 生成 Mock 回复（无 API Key 时使用）
 * @param {string} message 用户问题
 * @returns {string}
 */
function buildMockReply(message) {
  return `你问的是：「${message}」

这是**模拟回复**——当前后端未配置大模型 API Key，所以返回的是预置内容。

配置方法很简单：
1. 打开 backend 目录下的 .env 文件
2. 填入你的 API Key：LLM_API_KEY=sk-xxxxxx
3. 重启后端服务

配置完成后，这里就会返回模型生成的真实回答了，前端的流式渲染逻辑无需任何改动。

顺便说一句，作为旅游助手我通常能帮你这些事：
- 目的地选择与行程规划
- 景点、美食、住宿推荐
- 交通方案与预算估算
- 出行注意事项与证件准备

你想先了解哪个城市？`
}

/**
 * 流式 AI 对话
 * @param {object} options
 * @param {string} options.message 本轮用户消息
 * @param {Array<{role:'user'|'assistant', content:string}>} [options.history] 历史消息
 * @yields {string} 逐段返回的回复文本
 */
export async function* streamReply({ message, history = [] }) {
  // 只保留最近 20 条历史，避免上下文过长导致 token 浪费
  const recentHistory = history.slice(-20)

  const mockText = buildMockReply(message)

  yield* streamChat({
    system: SYSTEM_PROMPT,
    history: recentHistory,
    user: message,
    mockText
  })
}

export default { streamReply, QUICK_QUESTIONS, detectPlanIntent }
