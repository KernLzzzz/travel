/**
 * 用户鉴权相关接口
 */
import request from '@/utils/request'

export const login = (payload) => request.post('/auth/login', payload)

export const register = (payload) => request.post('/auth/register', payload)

export const getProfile = () => request.get('/auth/profile')

export const updateProfile = (payload) => request.put('/auth/profile', payload)

/** 保存旅行偏好档案（反哺规划表单预填） */
export const updatePreferences = (payload) => request.put('/auth/preferences', payload)

/** 修改密码 */
export const changePassword = (payload) => request.post('/auth/change-password', payload)
