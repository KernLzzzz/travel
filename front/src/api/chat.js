/**
 * AI 对话相关接口
 * 注意：对话本身（/chat/completions）是 SSE 流式接口，
 * 不走 Axios，由 utils/sse.js 直接调用
 */
import request from '@/utils/request'

export const listSessions = () => request.get('/chat/sessions')

export const createSession = (title) => request.post('/chat/sessions', title ? { title } : {})

export const getMessages = (sessionId) => request.get(`/chat/sessions/${sessionId}/messages`)

export const deleteSession = (sessionId) => request.delete(`/chat/sessions/${sessionId}`)

export const getQuickQuestions = () => request.get('/chat/quick-questions')
