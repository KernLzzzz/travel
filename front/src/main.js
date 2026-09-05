/**
 * 应用入口
 */
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

import 'element-plus/dist/index.css'
// Element Plus 官方暗色主题，配合 html.dark 类切换
import 'element-plus/theme-chalk/dark/css-vars.css'
import './styles/index.css'

import App from './App.vue'
import router from './router'
import { useAppStore } from './stores/app'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(ElementPlus, { locale: zhCn })

// 全局注册所有 Element Plus 图标，模板中可直接 <el-icon><Star /></el-icon>
for (const [name, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(name, component)
}

// 启动时应用用户上次选择的主题
useAppStore().initTheme()

app.mount('#app')
