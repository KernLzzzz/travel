/**
 * 行程数据状态（Pinia）
 * 暂存「刚生成但还未保存」的行程，供详情页展示；
 * 同时写入 sessionStorage，刷新页面也不丢失
 */
import { defineStore } from 'pinia'

const STORAGE_KEY = 'current_itinerary'

export const usePlanStore = defineStore('plan', {
  state: () => ({
    itinerary: null
  }),

  actions: {
    /** 保存一份刚生成的行程 */
    setItinerary(itinerary) {
      this.itinerary = itinerary
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(itinerary))
      } catch {
        // 存储失败不影响主流程
      }
    },

    /** 读取当前行程：优先内存，其次 sessionStorage */
    getItinerary() {
      if (this.itinerary) return this.itinerary
      try {
        const raw = sessionStorage.getItem(STORAGE_KEY)
        if (raw) {
          this.itinerary = JSON.parse(raw)
          return this.itinerary
        }
      } catch {
        // 解析失败按无数据处理
      }
      return null
    },

    clear() {
      this.itinerary = null
      sessionStorage.removeItem(STORAGE_KEY)
    }
  }
})
