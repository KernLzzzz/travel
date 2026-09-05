/**
 * 行程管理路由
 */
import { Router } from 'express'
import {
  createItinerary,
  listItineraries,
  getItinerary,
  updateItinerary,
  deleteItinerary,
  toggleFavorite,
  getStats
} from '../controllers/itineraryController.js'
import { authRequired } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

// 行程属于个人资产，全部接口要求登录
router.use(authRequired)

/** POST /api/itinerary - 保存行程 */
router.post('/', asyncHandler(createItinerary))

/** GET /api/itinerary - 行程列表（分页，支持关键词/城市筛选与排序） */
router.get('/', asyncHandler(listItineraries))

/** GET /api/itinerary/stats - 旅行足迹统计（必须注册在 /:id 之前，否则会被动态路由吞掉） */
router.get('/stats', asyncHandler(getStats))

/** GET /api/itinerary/:id - 行程详情 */
router.get('/:id', asyncHandler(getItinerary))

/** PUT /api/itinerary/:id - 更新行程内容或标题 */
router.put('/:id', asyncHandler(updateItinerary))

/** DELETE /api/itinerary/:id - 删除行程 */
router.delete('/:id', asyncHandler(deleteItinerary))

/** POST /api/itinerary/:id/favorite - 切换收藏 */
router.post('/:id/favorite', asyncHandler(toggleFavorite))

export default router
