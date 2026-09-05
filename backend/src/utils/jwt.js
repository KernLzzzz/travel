/**
 * JWT 工具
 * 负责令牌的签发与校验
 */
import jwt from 'jsonwebtoken'
import config from '../config/index.js'

/**
 * 签发令牌
 * @param {object} payload 载荷，通常只放 userId 这类最小信息
 * @returns {string} token
 */
export function signToken(payload) {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn
  })
}

/**
 * 校验令牌
 * @param {string} token
 * @returns {object|null} 校验成功返回载荷，失败返回 null
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwt.secret)
  } catch {
    // 过期、被篡改、格式错误统一返回 null，由上层决定如何响应
    return null
  }
}

/**
 * 从请求头中解析 Token
 * 支持两种写法：Authorization: Bearer <token> 与 Authorization: <token>
 * @param {import('express').Request} req
 * @returns {string|null}
 */
export function extractToken(req) {
  const header = req.get('Authorization') || ''
  if (!header) return null
  const [type, value] = header.split(/\s+/)
  return value || type || null
}

export default { signToken, verifyToken, extractToken }
