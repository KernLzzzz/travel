/**
 * 服务入口
 * 组装中间件、路由与错误处理，并负责优雅停机
 */
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import http from 'node:http'

import config from './config/index.js'
import { initPool, isDbAvailable } from './config/db.js'
import routes from './routes/index.js'
import { notFoundHandler, errorHandler } from './middleware/error.js'
import { modelInfo } from './services/llm.js'

const app = express()
const server = http.createServer(app)

/* ---------------- 中间件 ---------------- */

// 跨域：支持 .env 中配置多个来源
const origins = config.server.corsOrigin.split(',').map((s) => s.trim())
app.use(cors({ origin: origins, credentials: true }))

app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))

// 请求日志，生产环境只记录异常状态码
if (config.server.env === 'production') {
  app.use(morgan('combined', { skip: (req, res) => res.statusCode < 400 }))
} else {
  app.use(morgan('dev'))
}

/* ---------------- 路由 ---------------- */

app.use('/api', routes)

// 兜底：未匹配的路径返回 404 JSON，而不是 Express 默认的 HTML
app.use(notFoundHandler)

// 全局异常处理，必须放在所有路由之后
app.use(errorHandler)

/* ---------------- 优雅停机 ---------------- */

let shuttingDown = false

async function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`\n[Server] 收到 ${signal}，开始优雅停机...`)

  // 1. 停止接收新连接，等待存量请求处理完毕
  server.close(() => {
    console.log('[Server] 所有连接已关闭')
  })

  // 2. 兜底：超过 10 秒仍有连接未释放则强制退出，防止服务僵死
  const forceTimer = setTimeout(() => {
    console.warn('[Server] 等待超时，强制退出')
    process.exit(0)
  }, 10000)
  forceTimer.unref()

  // 3. 关闭数据库连接池
  try {
    const pool = await import('./config/db.js')
    const p = await pool.getPool()
    if (p) {
      await p.end()
      console.log('[Server] 数据库连接池已关闭')
    }
  } catch (err) {
    console.warn('[Server] 关闭数据库连接时出错：', err.message)
  }

  // 4. 等待流式请求收尾
  await new Promise((resolve) => setTimeout(resolve, 500))
  console.log('[Server] 已安全退出')
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

// 未捕获异常：记录后退出，交给进程管理器（PM2 / Docker）重启
process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]', err)
  shutdown('uncaughtException')
})

process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled Rejection]', reason)
})

/* ---------------- 启动 ---------------- */

async function bootstrap() {
  // 先尝试连接数据库，失败不影响服务启动
  await initPool()

  server.listen(config.server.port, () => {
    const info = modelInfo()
    console.log('')
    console.log('  ============================================')
    console.log('   智能旅游助手 · 后端服务已启动')
    console.log('  ============================================')
    console.log(`   地址       http://localhost:${config.server.port}`)
    console.log(`   环境       ${config.server.env}`)
    console.log(`   模型来源   ${info.providerName} / ${info.model}`)
    console.log(`   Mock 模式  ${info.mock ? '开启（未配置 API Key，使用模拟数据）' : '关闭（调用真实模型）'}`)
    console.log(`   数据库     ${isDbAvailable() ? '已连接' : '未连接（仅数据库功能不可用）'}`)
    console.log('  ============================================')
    console.log('')
  })
}

bootstrap()
