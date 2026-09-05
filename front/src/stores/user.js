/**
 * 用户状态（Pinia）
 * 管理登录态、用户信息，并同步到 localStorage 持久化
 */
import { defineStore } from 'pinia'
import * as authApi from '@/api/auth'

export const useUserStore = defineStore('user', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    userInfo: JSON.parse(localStorage.getItem('userInfo') || 'null')
  }),

  getters: {
    isLoggedIn: (state) => Boolean(state.token),
    nickname: (state) => state.userInfo?.nickname || state.userInfo?.username || '游客'
  },

  actions: {
    /** 登录成功后统一保存状态 */
    _saveSession({ token, user }) {
      this.token = token
      this.userInfo = user
      localStorage.setItem('token', token)
      localStorage.setItem('userInfo', JSON.stringify(user))
    },

    async login(payload) {
      const res = await authApi.login(payload)
      this._saveSession(res.data)
      return res
    },

    async register(payload) {
      const res = await authApi.register(payload)
      this._saveSession(res.data)
      return res
    },

    /** 刷新用户信息（静默失败） */
    async fetchProfile() {
      try {
        const res = await authApi.getProfile()
        this.userInfo = res.data
        localStorage.setItem('userInfo', JSON.stringify(res.data))
      } catch {
        // 401 已由 axios 拦截器统一处理
      }
    },

    async updateProfile(payload) {
      const res = await authApi.updateProfile(payload)
      this.userInfo = res.data
      localStorage.setItem('userInfo', JSON.stringify(res.data))
      return res
    },

    logout() {
      this.token = ''
      this.userInfo = null
      localStorage.removeItem('token')
      localStorage.removeItem('userInfo')
    }
  }
})
