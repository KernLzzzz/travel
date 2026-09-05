/**
 * 全局错误处理中间件
 * 必须注册在所有路由之后，且参数列表为四个（Express 靠参数个数识别错误处理器）
 */
import { ApiError } from '../utils/response.js'
import { GatewayError } from '../services/aiGateway.js'

export function notFoundHandler(req, res) {
  res.status(404).json({
    code: 404,
    message: `接口不存在：${req.method} ${req.originalUrl}`,
    data: null
  })
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // 业务错误：使用预设的状态码与提示
  if (err instanceof ApiError) {
    return res.status(err.code).json({
      code: err.code,
      message: err.message,
      data: null
    })
  }

  // AI 网关错误（限流/并发拒绝/超时）：透传真实状态码，前端才能给出对应提示
  if (err instanceof GatewayError) {
    return res.status(err.code).json({
      code: err.code,
      message: err.message,
      data: { retryAfterSec: err.retryAfterSec }
    })
  }

  // MySQL 唯一键冲突
  if (err && err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      code: 409,
      message: '数据已存在，请勿重复提交',
      data: null
    })
  }

  // 未预期的系统错误：打印堆栈便于排查，但不暴露给前端
  console.error('[Unhandled Error]', err)
  res.status(500).json({
    code: 500,
    message: '服务器内部错误',
    data: null
  })
}

export default { notFoundHandler, errorHandler }
