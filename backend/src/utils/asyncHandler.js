/**
 * 异步路由处理器包装器
 *
 * Express 4 不会自动捕获 async 函数中抛出的异常，
 * 不包一层的话，控制器里的异常会导致请求挂起而不是返回错误响应。
 *
 * @param {(req, res, next) => Promise<any>} fn 异步处理器
 * @returns {(req, res, next) => void}
 */
export function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

export default asyncHandler
