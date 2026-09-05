import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5173,
    open: false,
    // 把 /api 前缀的请求转发到后端，前端代码里统一写相对路径即可
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
        // SSE 流式响应不需要 ws，这里只做普通 HTTP 转发
      }
    }
  },
  build: {
    outDir: 'dist',
    // 关闭 sourcemap，避免源码泄露
    sourcemap: false,
    chunkSizeWarningLimit: 1500
  }
})
