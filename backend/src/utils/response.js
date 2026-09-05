/**
 * 统一 API 响应封装
 * 全站接口统一返回格式：{ code, message, data }
 * code 直接复用 HTTP 状态码，前端无需二次映射
 */

/** 业务错误类：可自定义状态码，抛给全局错误中间件统一处理 */
export class ApiError extends Error {
  /**
   * @param {string} message 错误描述
   * @param {number} code HTTP 状态码，默认 500
   */
  constructor(message = '操作失败', code = 500) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

/**
 * 成功响应
 * @param {import('express').Response} res
 * @param {*} data 返回数据
 * @param {string} message 提示信息
 * @param {number} code HTTP 状态码
 */
export function ok(res, data = null, message = '操作成功', code = 200) {
  return res.status(code).json({ code, message, data })
}

/**
 * 失败响应
 * @param {import('express').Response} res
 * @param {string} message 错误描述
 * @param {number} code HTTP 状态码
 * @param {*} data 附加数据
 */
export function fail(res, message = '操作失败', code = 500, data = null) {
  const status = code >= 100 && code < 600 ? code : 500
  return res.status(status).json({ code: status, message, data })
}

/** 400 参数错误 */
export const badRequest = (res, message = '请求参数错误') => fail(res, message, 400)

/** 401 未登录或 Token 失效 */
export const unauthorized = (res, message = '请先登录') => fail(res, message, 401)

/** 403 无权限 */
export const forbidden = (res, message = '没有权限执行该操作') => fail(res, message, 403)

/** 404 资源不存在 */
export const notFound = (res, message = '资源不存在') => fail(res, message, 404)

/** 503 依赖服务不可用（如数据库未连接） */
export const unavailable = (res, message = '服务暂不可用') => fail(res, message, 503)

export default { ApiError, ok, fail, badRequest, unauthorized, forbidden, notFound, unavailable }
