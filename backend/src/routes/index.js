/**
 * 路由汇总
 */
import { Router } from 'express'
import authRoutes from './auth.js'
import travelRoutes from './travel.js'
import chatRoutes from './chat.js'
import itineraryRoutes from './itinerary.js'
import { isDbAvailable } from '../config/db.js'
import { modelInfo } from '../services/llm.js'
import { getMetrics } from '../services/aiGateway.js'
import { ok } from '../utils/response.js'

const router = Router()

/**
 * GET /api/health - 健康检查
 * 返回模型配置、数据库连通性与 AI 网关运行时指标
 */
router.get('/health', (req, res) => {
  ok(
    res,
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
      model: modelInfo(),
      database: { connected: isDbAvailable() },
      gateway: getMetrics()
    },
    '服务运行正常'
  )
})

router.use('/auth', authRoutes)
router.use('/travel', travelRoutes)
router.use('/chat', chatRoutes)
router.use('/itinerary', itineraryRoutes)

export default router
