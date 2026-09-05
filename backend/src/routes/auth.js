/**
 * 用户鉴权路由
 */
import { Router } from 'express'
import { register, login, getProfile, updateProfile, updatePreferences, changePassword } from '../controllers/authController.js'
import { authRequired } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

/** POST /api/auth/register - 注册 */
router.post('/register', asyncHandler(register))

/** POST /api/auth/login - 登录 */
router.post('/login', asyncHandler(login))

/** GET /api/auth/profile - 获取当前用户资料 */
router.get('/profile', authRequired, asyncHandler(getProfile))

/** PUT /api/auth/profile - 更新个人资料 */
router.put('/profile', authRequired, asyncHandler(updateProfile))

/** PUT /api/auth/preferences - 更新旅行偏好档案 */
router.put('/preferences', authRequired, asyncHandler(updatePreferences))

/** POST /api/auth/change-password - 修改密码 */
router.post('/change-password', authRequired, asyncHandler(changePassword))

export default router
