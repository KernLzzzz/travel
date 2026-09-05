/**
 * 旅游规划路由
 */
import { Router } from 'express'
import { recommend, getMeta, swapSpot } from '../controllers/travelController.js'
import { authOptional } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

/**
 * POST /api/travel/recommend - 流式生成旅游行程
 * 使用 authOptional：登录用户按 userId 限流，未登录按 IP 限流
 * 这样既保证鉴权体系完整，又方便未登录状态下直接体验
 */
router.post('/recommend', authOptional, asyncHandler(recommend))

/**
 * POST /api/travel/swap - 行程内单个时段重生成（换一个）
 * 同样走 authOptional，与行程生成的限流策略保持一致
 */
router.post('/swap', authOptional, asyncHandler(swapSpot))

/** GET /api/travel/meta - 获取热门城市与快捷提问 */
router.get('/meta', getMeta)

export default router
