/**
 * AI 对话控制器
 * 处理流式对话与会话管理
 *
 * 设计要点：数据库不可用时，对话本身依然可用，仅失去历史持久化能力。
 */
import crypto from 'node:crypto'
import { createSSE } from '../utils/sse.js'
import { streamReply, QUICK_QUESTIONS, detectPlanIntent } from '../services/chatService.js'
import { streamItinerary, parseItineraryJSON, normalizeItinerary } from '../services/travelService.js'
import { guardedStream, hashKey } from '../services/aiGateway.js'
import { query, isDbAvailable } from '../config/db.js'
import { ok, ApiError } from '../utils/response.js'

/** 上下文窗口：最多携带的历史消息条数，兼顾连贯性与 token 成本 */
const CONTEXT_LIMIT = 20

/**
 * 读取会话历史（数据库不可用时返回空数组）
 * @param {string} sessionId
 * @param {number|undefined} userId
 * @returns {Promise<Array>}
 */
async function loadHistory(sessionId, userId) {
  if (!isDbAvailable() || !sessionId) return []
  try {
    const rows = await query(
      'SELECT role, content FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC, id ASC',
      [sessionId]
    )
    return rows
  } catch {
    return []
  }
}

/**
 * 写入一条消息（静默失败，不阻断对话）
 * @param {string} sessionId
 * @param {'user'|'assistant'} role
 * @param {string} content
 */
async function saveMessage(sessionId, role, content) {
  if (!isDbAvailable() || !sessionId || !content) return
  try {
    await query('INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)', [
      sessionId,
      role,
      content
    ])
  } catch (err) {
    console.warn('[Chat] 消息持久化失败：', err.message)
  }
}

/**
 * 更新会话标题（取首条用户消息的前 20 字）
 * @param {string} sessionId
 * @param {string} content
 */
async function ensureSessionTitle(sessionId, content) {
  if (!isDbAvailable() || !sessionId) return
  try {
    const title = content.slice(0, 20)
    await query("UPDATE chat_sessions SET title = ? WHERE id = ? AND title = '新的对话'", [title, sessionId])
  } catch {
    // 标题更新失败不影响主流程
  }
}

/**
 * 校验会话归属，防止越权访问（IDOR）
 * 未登录或没有 sessionId 时跳过
 * @param {string} sessionId
 * @param {number|undefined} userId
 */
async function assertSessionOwned(sessionId, userId) {
  if (!sessionId || !userId) return
  const rows = await query('SELECT id FROM chat_sessions WHERE id = ? AND user_id = ? LIMIT 1', [
    sessionId,
    userId
  ])
  if (rows.length === 0) {
    throw new ApiError('会话不存在或无权访问', 404)
  }
}

/**
 * 以打字机效果输出一段固定文本
 * @param {string} text
 * @param {object} sse SSE 控制器
 */
async function streamFixedText(text, sse, step = 6, delay = 20) {
  for (let i = 0; i < text.length; i += step) {
    if (sse.closed) return
    sse.chunk(text.slice(i, i + step))
    await new Promise((r) => setTimeout(r, delay))
  }
}

/**
 * 处理行程规划意图：生成行程并在回复中内嵌行程卡片
 * @returns {Promise<boolean>} 是否已处理（true 表示主流程无需继续）
 */
async function handlePlanIntent({ intent, userText, sessionId, sse, rateLimitKey }) {
  const intro = `好的，正在为你规划 ${intent.city} ${intent.days} 日游，预算约 ${intent.budget} 元。行程已生成，点击下方卡片可查看完整规划，有任何想调整的也可以继续告诉我。`

  // 1. 打字机输出引导语
  await streamFixedText(intro, sse)
  if (sse.closed) return true

  // 2. 通过 AI 网关生成行程（复用限流、缓存、超时控制；JSON 内容不推送到对话气泡）
  let raw = ''
  try {
    const stream = guardedStream({
      rateLimitKey,
      cacheKey: `itinerary:${hashKey(JSON.stringify(intent))}`,
      traceId: sse.traceId,
      call: () => streamItinerary(intent),
      onComplete: (t) => {
        raw = t
      }
    })
    for await (const _chunk of stream) {
      if (sse.closed) break
    }
  } catch (err) {
    // 生成失败：降级为普通文字回复，不让对话中断
    console.warn('[Chat] 对话内行程生成失败，降级处理：', err.message)
    return false
  }

  if (sse.closed) return true

  const parsed = parseItineraryJSON(raw)
  if (!parsed) return false

  const itinerary = normalizeItinerary(parsed, intent)

  // 3. 持久化：行程卡片消息以 [ITINERARY] 前缀存储
  if (sessionId) {
    await saveMessage(sessionId, 'user', userText)
    await saveMessage(sessionId, 'assistant', `[ITINERARY]${JSON.stringify({ text: intro, itinerary })}`)
    await ensureSessionTitle(sessionId, userText)
  }

  sse.done({ reply: intro, itinerary, sessionId })
  return true
}

/**
 * 流式 AI 对话
 * POST /api/chat/completions
 * body: { message, sessionId? }
 */
export async function chat(req, res) {
  const { message, sessionId } = req.body || {}

  if (!message || typeof message !== 'string' || !message.trim()) {
    throw new ApiError('消息内容不能为空', 400)
  }

  // 关键安全校验：确保 sessionId 属于当前用户，防止读写他人会话
  await assertSessionOwned(sessionId, req.userId)

  const userText = message.trim()

  // 加载历史上下文
  const history = await loadHistory(sessionId, req.userId)

  const sse = createSSE(req, res)
  sse.emit('start', { traceId: sse.traceId, sessionId: sessionId || null })

  const rateLimitKey = req.userId ? `user:${req.userId}` : `ip:${req.ip}`

  try {
    // 行程规划意图：在对话中直接内嵌行程卡片
    const intent = detectPlanIntent(userText)
    if (intent) {
      const handled = await handlePlanIntent({ intent, userText, sessionId, sse, rateLimitKey })
      if (handled) return
    }

    let full = ''

    const stream = guardedStream({
      rateLimitKey,
      // 首轮对话无历史，可安全缓存；多轮对话带上下文，不缓存以免串味
      cacheKey: history.length === 0 ? `chat:${hashKey(userText)}` : null,
      traceId: sse.traceId,
      call: () => streamReply({ message: userText, history: history.slice(-CONTEXT_LIMIT) }),
      onComplete: (text) => {
        full = text
      }
    })

    for await (const chunk of stream) {
      if (sse.closed) break
      sse.chunk(chunk)
    }

    if (sse.closed) return

    // 落库：用户消息 + 助手回复
    if (sessionId) {
      await saveMessage(sessionId, 'user', userText)
      await saveMessage(sessionId, 'assistant', full)
      await ensureSessionTitle(sessionId, userText)
    }

    sse.done({ reply: full, sessionId: sessionId || null })
  } catch (err) {
    if (!sse.closed) {
      sse.error(err?.message || '对话失败，请稍后重试')
    }
  }
}

/**
 * 获取会话列表
 * GET /api/chat/sessions
 */
export async function listSessions(req, res) {
  if (!isDbAvailable()) {
    return ok(res, [])
  }

  const rows = await query(
    'SELECT id, title, created_at, updated_at FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50',
    [req.userId]
  )
  ok(res, rows)
}

/**
 * 新建会话
 * POST /api/chat/sessions
 */
export async function createSession(req, res) {
  if (!isDbAvailable()) {
    throw new ApiError('数据库未连接，无法创建会话', 503)
  }

  const id = crypto.randomUUID()
  await query('INSERT INTO chat_sessions (id, user_id, title) VALUES (?, ?, ?)', [
    id,
    req.userId,
    req.body?.title || '新的对话'
  ])

  ok(res, { id, title: req.body?.title || '新的对话' }, '会话创建成功', 201)
}

/**
 * 获取会话的历史消息
 * GET /api/chat/sessions/:id/messages
 */
export async function getMessages(req, res) {
  if (!isDbAvailable()) {
    return ok(res, [])
  }

  const { id } = req.params

  // 校验归属，防止越权读取他人会话
  const owned = await query('SELECT id FROM chat_sessions WHERE id = ? AND user_id = ? LIMIT 1', [id, req.userId])
  if (owned.length === 0) {
    throw new ApiError('会话不存在或无权访问', 404)
  }

  const rows = await query(
    'SELECT id, role, content, created_at FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC, id ASC',
    [id]
  )
  ok(res, rows)
}

/**
 * 删除会话（级联删除其下所有消息）
 * DELETE /api/chat/sessions/:id
 */
export async function deleteSession(req, res) {
  if (!isDbAvailable()) {
    throw new ApiError('数据库未连接，无法删除会话', 503)
  }

  const { id } = req.params
  const result = await query('DELETE FROM chat_sessions WHERE id = ? AND user_id = ?', [id, req.userId])

  if (result.affectedRows === 0) {
    throw new ApiError('会话不存在或无权删除', 404)
  }

  ok(res, null, '会话已删除')
}

/**
 * 获取快捷提问
 * GET /api/chat/quick-questions
 */
export function getQuickQuestions(req, res) {
  ok(res, QUICK_QUESTIONS)
}

export default { chat, listSessions, createSession, getMessages, deleteSession, getQuickQuestions }
