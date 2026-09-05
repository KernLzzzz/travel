/**
 * Axios 实例封装
 * 统一处理：baseURL、Token 注入、错误提示、401 跳转登录
 *
 * 注意：直接读写 localStorage 而不引入 store，避免与 store 模块产生循环依赖
 */
import axios from 'axios'
import { ElMessage } from 'element-plus'

const request = axios.create({
  baseURL: '/api',
  timeout: 30000
})

/** 请求拦截：自动带上 Token */
request.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/** 响应拦截：统一错误处理 */
request.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error.response?.status
    const message = error.response?.data?.message || error.message || '网络异常'

    // Token 失效：清理登录态并跳转登录页
    if (status === 401) {
      localStorage.removeItem('token')
      ElMessage.error('登录已过期，请重新登录')
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    } else {
      ElMessage.error(message)
    }

    return Promise.reject(error)
  }
)

export default request
