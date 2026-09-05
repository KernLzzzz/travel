/**
 * 用户鉴权控制器
 * 处理注册、登录、资料读写
 */
import bcrypt from 'bcryptjs'
import { query, isDbAvailable } from '../config/db.js'
import { signToken } from '../utils/jwt.js'
import { ok, ApiError } from '../utils/response.js'

/** 数据库不可用时抛出统一错误 */
function assertDb() {
  if (!isDbAvailable()) {
    throw new ApiError('数据库未连接，请检查 .env 中的 DB_* 配置并执行 sql/schema.sql', 503)
  }
}

/** 密码加密强度，10 是安全与性能的常用平衡点 */
const SALT_ROUNDS = 10

/**
 * 安全解析 JSON 字段
 * mysql2 对 JSON 列的处理在不同版本下可能返回字符串或对象，这里统一成对象
 */
function safeParseJSON(value) {
  if (value == null) return null
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

/**
 * 用户注册
 * POST /api/auth/register
 */
export async function register(req, res) {
  assertDb()

  const { username, password, nickname } = req.body || {}

  // 参数校验
  if (!username || !password) {
    throw new ApiError('用户名和密码不能为空', 400)
  }
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    throw new ApiError('用户名只能包含字母、数字、下划线，长度 3-20 位', 400)
  }
  if (password.length < 6) {
    throw new ApiError('密码长度不能少于 6 位', 400)
  }

  // 用户名查重
  const exists = await query('SELECT id FROM users WHERE username = ? LIMIT 1', [username])
  if (exists.length > 0) {
    throw new ApiError('该用户名已被注册', 409)
  }

  const hashed = await bcrypt.hash(password, SALT_ROUNDS)
  const result = await query('INSERT INTO users (username, password, nickname) VALUES (?, ?, ?)', [
    username,
    hashed,
    nickname || username
  ])

  const token = signToken({ userId: result.insertId })

  ok(
    res,
    {
      token,
      user: { id: result.insertId, username, nickname: nickname || username }
    },
    '注册成功',
    201
  )
}

/**
 * 用户登录
 * POST /api/auth/login
 */
export async function login(req, res) {
  assertDb()

  const { username, password } = req.body || {}
  if (!username || !password) {
    throw new ApiError('用户名和密码不能为空', 400)
  }

  const rows = await query('SELECT id, username, password, nickname, avatar FROM users WHERE username = ? LIMIT 1', [
    username
  ])

  if (rows.length === 0) {
    throw new ApiError('用户不存在', 401)
  }

  const user = rows[0]
  const matched = await bcrypt.compare(password, user.password)
  if (!matched) {
    throw new ApiError('密码错误', 401)
  }

  const token = signToken({ userId: user.id })

  ok(
    res,
    {
      token,
      user: { id: user.id, username: user.username, nickname: user.nickname, avatar: user.avatar }
    },
    '登录成功'
  )
}

/**
 * 获取当前登录用户资料
 * GET /api/auth/profile
 */
export async function getProfile(req, res) {
  assertDb()

  const rows = await query(
    'SELECT id, username, nickname, avatar, preferences, created_at FROM users WHERE id = ? LIMIT 1',
    [req.userId]
  )

  if (rows.length === 0) {
    throw new ApiError('用户不存在', 404)
  }

  const user = rows[0]
  ok(res, { ...user, preferences: safeParseJSON(user.preferences) })
}

/**
 * 更新个人资料
 * PUT /api/auth/profile
 */
export async function updateProfile(req, res) {
  assertDb()

  const { nickname, avatar } = req.body || {}
  if (!nickname && !avatar) {
    throw new ApiError('没有需要更新的内容', 400)
  }

  await query('UPDATE users SET nickname = COALESCE(?, nickname), avatar = COALESCE(?, avatar) WHERE id = ?', [
    nickname || null,
    avatar || null,
    req.userId
  ])

  const rows = await query('SELECT id, username, nickname, avatar FROM users WHERE id = ? LIMIT 1', [req.userId])
  ok(res, rows[0], '资料更新成功')
}

/**
 * 更新旅行偏好档案
 * PUT /api/auth/preferences
 * 偏好用于规划表单预填，全部字段可选、只更新传入的部分；数值字段做范围钳制
 */
export async function updatePreferences(req, res) {
  assertDb()

  const body = req.body || {}
  const pref = {}

  if (body.homeCity !== undefined) pref.homeCity = String(body.homeCity).slice(0, 30)
  if (body.defaultBudget !== undefined) {
    pref.defaultBudget = Math.min(100000, Math.max(0, Number(body.defaultBudget) || 0))
  }
  if (body.defaultDays !== undefined) {
    pref.defaultDays = Math.min(15, Math.max(1, Number(body.defaultDays) || 3))
  }
  if (body.defaultTravelers !== undefined) {
    pref.defaultTravelers = Math.min(20, Math.max(1, Number(body.defaultTravelers) || 2))
  }
  if (body.companion !== undefined) pref.companion = String(body.companion).slice(0, 20)
  if (Array.isArray(body.themes)) {
    pref.themes = body.themes.map((t) => String(t).slice(0, 20)).slice(0, 10)
  }
  if (body.pacing !== undefined) pref.pacing = String(body.pacing).slice(0, 10)
  if (body.defaultPreference !== undefined) {
    pref.defaultPreference = String(body.defaultPreference).slice(0, 100)
  }

  if (Object.keys(pref).length === 0) {
    throw new ApiError('没有需要更新的偏好内容', 400)
  }

  await query('UPDATE users SET preferences = ? WHERE id = ?', [JSON.stringify(pref), req.userId])

  ok(res, pref, '偏好已保存')
}

/**
 * 修改密码
 * POST /api/auth/change-password
 * body: { oldPassword, newPassword }
 */
export async function changePassword(req, res) {
  assertDb()

  const { oldPassword, newPassword } = req.body || {}
  if (!oldPassword || !newPassword) {
    throw new ApiError('请填写旧密码与新密码', 400)
  }
  if (String(newPassword).length < 6) {
    throw new ApiError('新密码长度不能少于 6 位', 400)
  }
  if (String(newPassword) === String(oldPassword)) {
    throw new ApiError('新密码不能与旧密码相同', 400)
  }

  const rows = await query('SELECT id, password FROM users WHERE id = ? LIMIT 1', [req.userId])
  if (rows.length === 0) {
    throw new ApiError('用户不存在', 404)
  }

  const matched = await bcrypt.compare(String(oldPassword), rows[0].password)
  if (!matched) {
    throw new ApiError('旧密码不正确', 400)
  }

  const hashed = await bcrypt.hash(String(newPassword), SALT_ROUNDS)
  await query('UPDATE users SET password = ? WHERE id = ?', [hashed, req.userId])

  ok(res, null, '密码修改成功')
}

export default { register, login, getProfile, updateProfile, updatePreferences, changePassword }
