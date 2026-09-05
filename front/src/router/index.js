/**
 * 路由配置
 * 登录/注册为独立页面，其余页面挂在主布局下并要求登录
 */
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '登录' }
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/Register.vue'),
    meta: { title: '注册' }
  },
  {
    path: '/',
    component: () => import('@/layout/index.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', name: 'home', component: () => import('@/views/Plan.vue'), meta: { title: '行程规划' } },
      { path: 'detail', name: 'detail', component: () => import('@/views/Detail.vue'), meta: { title: '行程详情' } },
      { path: 'chat', name: 'chat', component: () => import('@/views/Chat.vue'), meta: { title: 'AI 对话' } },
      { path: 'my', name: 'my', component: () => import('@/views/MyItineraries.vue'), meta: { title: '我的行程' } },
      { path: 'stats', name: 'stats', component: () => import('@/views/Stats.vue'), meta: { title: '旅行足迹' } },
      { path: 'profile', name: 'profile', component: () => import('@/views/Profile.vue'), meta: { title: '个人中心' } }
    ]
  },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

/** 全局前置守卫：未登录访问受保护页面时跳转登录 */
router.beforeEach((to) => {
  const token = localStorage.getItem('token')

  if (to.meta.requiresAuth && !token) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  // 已登录用户访问登录/注册页时直接进首页
  if ((to.name === 'login' || to.name === 'register') && token) {
    return { path: '/' }
  }

  return true
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · 远行者` : '远行者 · AI Travel Planner'
})

export default router
