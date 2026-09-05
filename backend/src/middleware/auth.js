/**
 * 鉴权中间件
 * 校验 JWT，通过后把 userId 挂载到 req 上供后续控制器使用
 */
import { unauthorized } from '../utils/response.js'
import { extractToken, verifyToken } from '../utils/jwt.js'

/**
 * 必须登录
 * 用法：router.get('/xxx', authRequired, handler)
 */
export function authRequired(req, res, next) {
  const token = extractToken(req)
  if (!token) return unauthorized(res, '缺少登录凭证，请先登录')

  const payload = verifyToken(token)
  if (!payload || !payload.userId) {
    return unauthorized(res, '登录已过期，请重新登录')
  }

  req.userId = payload.userId
  next()
}

/**
 * 可选登录
 * 有 token 就解析，没有也放行，用于「登录与不登录都能用」的接口
 */
export function authOptional(req, res, next) {
  const token = extractToken(req)
  if (token) {
    const payload = verifyToken(token)
    if (payload && payload.userId) req.userId = payload.userId
  }
  next()
}

export default { authRequired, authOptional }
