/**
 * 应用全局状态（Pinia）
 * 目前只负责深色模式开关，后续可扩展全局加载、消息中心等
 */
import { defineStore } from 'pinia'

/** 把主题应用到 <html> 元素，Element Plus 的暗色主题依赖 html.dark 类 */
function applyTheme(dark) {
  document.documentElement.classList.toggle('dark', dark)
}

export const useAppStore = defineStore('app', {
  state: () => ({
    dark: localStorage.getItem('theme') === 'dark'
  }),

  actions: {
    initTheme() {
      applyTheme(this.dark)
    },

    toggleDark() {
      this.dark = !this.dark
      localStorage.setItem('theme', this.dark ? 'dark' : 'light')
      applyTheme(this.dark)
    }
  }
})
