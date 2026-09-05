/**
 * 行程管理相关接口
 */
import request from '@/utils/request'

export const saveItinerary = (payload) => request.post('/itinerary', payload)

export const listItineraries = (params) => request.get('/itinerary', { params })

export const getItinerary = (id) => request.get(`/itinerary/${id}`)

/** 更新行程（内容或标题，只传需要改的字段） */
export const updateItinerary = (id, payload) => request.put(`/itinerary/${id}`, payload)

export const deleteItinerary = (id) => request.delete(`/itinerary/${id}`)

export const toggleFavorite = (id) => request.post(`/itinerary/${id}/favorite`)

/** 旅行足迹统计（概览 + 城市分布 + 最近足迹） */
export const getStats = () => request.get('/itinerary/stats')
