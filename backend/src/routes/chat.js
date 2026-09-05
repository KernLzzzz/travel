/**
 * AI 对话路由
 */
import { Router } from 'express'
import {
  chat,
  listSessions,
  createSession,
  getMessages,
  deleteSession,
  getQuickQuestions
} from '../controllers/chatController.js'
import { authRequired, authOptional } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

/**
 * POST /api/chat/completions - 流式对话
 * 未登录也能对话，但历史不会被保存
 */
router.post('/completions', authOptional, asyncHandler(chat))

/** GET /api/chat/sessions - 会话列表 */
router.get('/sessions', authRequired, asyncHandler(listSessions))

/** POST /api/chat/sessions - 新建会话 */
router.post('/sessions', authRequired, asyncHandler(createSession))

/** GET /api/chat/sessions/:id/messages - 会话历史消息 */
router.get('/sessions/:id/messages', authRequired, asyncHandler(getMessages))

/** DELETE /api/chat/sessions/:id - 删除会话（级联删除其下消息） */
router.delete('/sessions/:id', authRequired, asyncHandler(deleteSession))

/** GET /api/chat/quick-questions - 快捷提问 */
router.get('/quick-questions', getQuickQuestions)

export default router
