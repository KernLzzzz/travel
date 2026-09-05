/**
 * SSE（Server-Sent Events）流式响应工具
 *
 * 解决三个实际问题：
 * 1. 设置正确的响应头，否则前端永远收不到数据或被 Nginx 缓冲
 * 2. 客户端断开连接后停止写入，避免继续消耗大模型 token
 * 3. 统一的消息格式，前端只需解析一种结构
 */
import crypto from 'node:crypto'

/**
 * 构造一个 SSE 数据帧
 * @param {string} event 事件名
 * @param {object} data 数据体
 * @returns {string}
 */
function frame(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

/**
 * 创建一条 SSE 连接
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {object} 会话控制器
 */
export function createSSE(req, res) {
  // 响应头：禁用缓存与代理缓冲，保证数据实时到达前端
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.status(200)
  if (typeof res.flushHeaders === 'function') res.flushHeaders()

  let closed = false

  // Nginx 等网关可能断开空闲连接，定期发送注释帧保活
  const heartbeat = setInterval(() => {
    if (!closed && !res.writableEnded) res.write(': keep-alive\n\n')
  }, 15000)

  const onClose = () => {
    closed = true
    clearInterval(heartbeat)
  }

  // 必须监听 response 的 close 来判断客户端断开。
  // 不能监听 request：请求体读完后 request 就会触发 close，
  // 会导致响应刚推第一帧就被误判为「客户端已断开」，后续内容全部丢失。
  res.on('close', onClose)
  res.on('error', onClose)

  return {
    /** 连接是否已被客户端关闭 */
    get closed() {
      return closed
    },

    /** 本次流式请求的追踪 ID，便于日志排查 */
    traceId: crypto.randomUUID(),

    /**
     * 推送一小段生成内容
     * @param {string} content
     */
    chunk(content) {
      if (closed || content == null) return
      res.write(frame('chunk', { content }))
    },

    /**
     * 推送自定义事件
     * @param {string} event 事件名
     * @param {object} data 数据
     */
    emit(event, data = {}) {
      if (closed) return
      res.write(frame(event, data))
    },

    /**
     * 正常结束：发送完整数据后关闭连接
     * @param {object} data 最终完整数据
     */
    done(data = {}) {
      if (closed) return
      res.write(frame('done', data))
      res.end()
      onClose()
    },

    /**
     * 异常结束：推送错误信息后关闭连接
     * @param {string} message
     */
    error(message = '生成失败') {
      if (closed) return
      res.write(frame('error', { message }))
      res.end()
      onClose()
    }
  }
}

export default { createSSE }
