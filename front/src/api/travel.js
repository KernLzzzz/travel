/**
 * 旅游规划相关接口
 * 注意：行程生成（/travel/recommend）是 SSE 流式接口，
 * 不走 Axios，由 utils/sse.js 直接调用
 */
import request from '@/utils/request'

/** 获取热门城市与快捷提问 */
export const getMeta = () => request.get('/travel/meta')

/**
 * 单景点重生成（换一个）
 * payload: { city, day, period, current, days?, theme?, budget?, companion?, themes?, preference? }
 * 模型调用可能较慢，单独放宽超时时间（网关上限为 120s）
 */
export const swapSpot = (payload) => request.post('/travel/swap', payload, { timeout: 120000 })

/** 健康检查（含模型配置与网关指标） */
export const getHealth = () => request.get('/health')
