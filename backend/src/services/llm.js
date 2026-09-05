/**
 * 大模型服务（LangChain 封装）
 *
 * 对外只暴露一个 streamChat 生成器，调用方用 for await 逐段取内容即可。
 * 未配置 API Key 时自动走 Mock 模式，保证无 Key 也能完整跑通业务流程。
 */
import { ChatOpenAI } from '@langchain/openai'
import { SystemMessage, HumanMessage, AIMessage } from '@langchain/core/messages'
import config from '../config/index.js'

/** 模型实例缓存，避免每次请求重复创建 */
let cachedModel = null

/** 获取（或创建）模型实例 */
function getModel() {
  if (cachedModel) return cachedModel

  const { apiKey, baseURL, model, temperature, maxTokens } = config.llm

  cachedModel = new ChatOpenAI({
    // Mock 模式下 apiKey 为空，占位避免 SDK 初始化报错
    apiKey: apiKey || 'sk-mock-placeholder',
    modelName: model,
    temperature,
    maxTokens,
    streaming: true,
    configuration: { baseURL }
  })

  return cachedModel
}

/**
 * 从模型返回的 chunk 中安全提取文本
 * 不同模型 content 可能是字符串，也可能是含 text 字段的数组
 * @param {any} chunk
 * @returns {string}
 */
function textOf(chunk) {
  const content = chunk?.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content.map((part) => (typeof part === 'string' ? part : part?.text || '')).join('')
  }
  return ''
}

/**
 * 模拟流式输出
 * 把一段文本切成小块逐段返回，模拟真实模型的打字机效果
 * @param {string} text 要输出的文本
 */
async function* mockStream(text) {
  const step = 12
  for (let i = 0; i < text.length; i += step) {
    // 稍微停顿，让前端的流式渲染效果可见
    await new Promise((resolve) => setTimeout(resolve, 30))
    yield text.slice(i, i + step)
  }
}

/**
 * 流式对话
 * @param {object} options
 * @param {string} options.system 系统提示词
 * @param {Array<{role:'user'|'assistant', content:string}>} [options.history] 历史消息
 * @param {string} options.user 本轮用户输入
 * @param {string} [options.mockText] Mock 模式下要输出的文本
 * @yields {string} 逐段返回的文本内容
 */
export async function* streamChat({ system, history = [], user, mockText }) {
  // Mock 模式：无需网络请求，直接输出预置文本
  if (config.llm.mock) {
    yield* mockStream(mockText || '（Mock 模式）这是模拟输出。请在 .env 中配置 LLM_API_KEY 以调用真实模型。')
    return
  }

  const messages = [
    new SystemMessage(system),
    ...history.map((m) => (m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content))),
    new HumanMessage(user)
  ]

  try {
    const model = getModel()
    const stream = await model.stream(messages)
    for await (const chunk of stream) {
      const text = textOf(chunk)
      if (text) yield text
    }
  } catch (err) {
    // 统一包装错误信息，避免把 SDK 内部堆栈直接抛给上层
    const status = err?.response?.status || err?.status
    const detail = err?.response?.data?.error?.message || err?.message || '未知错误'
    throw new Error(`模型调用失败${status ? `（HTTP ${status}）` : ''}：${detail}`)
  }
}

/** 当前是否处于 Mock 模式 */
export function isMock() {
  return config.llm.mock
}

/** 获取当前模型信息，用于健康检查接口 */
export function modelInfo() {
  return {
    provider: config.llm.provider,
    providerName: config.llm.providerName,
    model: config.llm.model,
    baseURL: config.llm.baseURL,
    mock: config.llm.mock
  }
}

export default { streamChat, isMock, modelInfo }
