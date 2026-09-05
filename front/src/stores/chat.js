/**
 * AI 对话状态（Pinia）
 * 管理会话列表、当前会话与消息流
 *
 * 消息对象结构：
 * { role: 'user'|'assistant', type: 'text'|'itinerary', content: string,
 *   itinerary?: object, timestamp: number, streaming?: boolean }
 */
import { defineStore } from 'pinia'
import * as chatApi from '@/api/chat'

export const useChatStore = defineStore('chat', {
  state: () => ({
    /** 会话列表 */
    sessions: [],
    /** 当前会话 ID（null 表示未保存的新会话） */
    currentSessionId: null,
    /** 当前会话消息 */
    messages: [],
    /** 是否正在流式接收 */
    streaming: false,
    /** 数据库不可用时，会话历史不可持久化，仅保留内存状态 */
    dbReady: true
  }),

  getters: {
    currentSession: (state) =>
      state.sessions.find((s) => s.id === state.currentSessionId) || null
  },

  actions: {
    /** 加载会话列表 */
    async loadSessions() {
      try {
        const res = await chatApi.listSessions()
        this.sessions = res.data || []
        this.dbReady = true
      } catch {
        this.dbReady = false
      }
    },

    /** 切换到某个会话并加载其历史消息 */
    async openSession(id) {
      this.currentSessionId = id
      try {
        const res = await chatApi.getMessages(id)
        this.messages = (res.data || []).map((m) => parseHistoryMessage(m))
      } catch {
        this.messages = []
      }
    },

    /** 开始新会话（本地重置，首次发消息时再由后端创建记录） */
    newSession() {
      this.currentSessionId = null
      this.messages = []
    },

    /** 发送前确保会话已在后端创建，返回可用的 sessionId */
    async ensureSession() {
      if (this.currentSessionId) return this.currentSessionId
      try {
        const res = await chatApi.createSession()
        const id = res.data.id
        this.currentSessionId = id
        await this.loadSessions()
        return id
      } catch {
        // 数据库不可用时返回 null，对话仍可继续但历史不保存
        return null
      }
    },

    async deleteSession(id) {
      await chatApi.deleteSession(id)
      this.sessions = this.sessions.filter((s) => s.id !== id)
      if (this.currentSessionId === id) this.newSession()
    },

    appendMessage(message) {
      this.messages.push(message)
    },

    setStreaming(value) {
      this.streaming = value
    }
  }
})

/**
 * 解析后端返回的历史消息
 * 行程卡片消息以 [ITINERARY] 前缀存储在 content 中，还原为卡片类型
 * @param {{role: string, content: string, created_at: string}} m
 */
function parseHistoryMessage(m) {
  const base = {
    role: m.role,
    type: 'text',
    content: m.content,
    timestamp: m.created_at ? new Date(m.created_at).getTime() : Date.now()
  }

  if (m.role === 'assistant' && m.content?.startsWith('[ITINERARY]')) {
    try {
      const payload = JSON.parse(m.content.slice(11))
      return {
        ...base,
        type: 'itinerary',
        content: payload.text || '',
        itinerary: payload.itinerary || null
      }
    } catch {
      return base
    }
  }
  return base
}
