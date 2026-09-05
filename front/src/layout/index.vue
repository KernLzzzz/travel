<template>
  <div class="layout">
    <!-- 左侧导航 -->
    <aside class="sidebar">
      <div class="logo" @click="router.push('/')">
        <el-icon :size="26" color="#fff"><Guide /></el-icon>
        <div class="logo-text">
          <span class="logo-name">远行者</span>
          <span class="logo-sub">AI Travel Planner</span>
        </div>
      </div>

      <nav class="nav-menu">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ active: activeMenu === item.path }"
        >
          <el-icon :size="18"><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
        </router-link>
      </nav>

      <!-- 最近规划 -->
      <div class="recent-section">
        <div class="recent-title">最近规划</div>
        <div v-if="recentPlans.length" class="recent-list">
          <div
            v-for="plan in recentPlans"
            :key="plan.city + plan.days"
            class="recent-item"
            @click="goPlan(plan)"
          >
            <span class="recent-dot" :style="{ background: planColor(plan.city) }" />
            <span class="recent-name">{{ plan.city }} · {{ plan.days }}天</span>
          </div>
        </div>
        <div v-else class="recent-empty">暂无最近规划</div>
      </div>

      <div class="sidebar-footer">
        <span class="version">v1.0.0</span>
        <span class="version-sub">AI 驱动 · 流式生成</span>
      </div>
    </aside>

    <!-- 右侧主区 -->
    <div class="main">
      <header class="header">
        <h2 class="header-title">{{ route.meta.title || '智能旅游助手' }}</h2>
        <div class="header-actions">
          <el-tooltip :content="app.dark ? '切换为亮色' : '切换为深色'" placement="bottom">
            <el-button circle text @click="app.toggleDark()">
              <el-icon :size="18"><Sunny v-if="!app.dark" /><Moon v-else /></el-icon>
            </el-button>
          </el-tooltip>

          <el-dropdown trigger="click" @command="onCommand">
            <div class="user-chip">
              <el-avatar :size="32" :src="user.userInfo?.avatar || ''">{{ initial }}</el-avatar>
              <span class="nickname">{{ user.nickname }}</span>
              <el-icon :size="12"><ArrowDown /></el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">
                  <el-icon><User /></el-icon>个人中心
                </el-dropdown-item>
                <el-dropdown-item command="about">
                  <el-icon><InfoFilled /></el-icon>关于我们
                </el-dropdown-item>
                <el-dropdown-item divided command="logout">
                  <el-icon><SwitchButton /></el-icon>退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <main class="content">
        <router-view />
      </main>
    </div>

    <!-- 关于弹窗 -->
    <el-dialog v-model="aboutVisible" title="关于我们" width="440px">
      <div class="about">
        <p><strong>远行者 v1.0.0</strong></p>
        <p>基于大语言模型的个性化旅游规划平台</p>
        <p class="about-tech">Vue 3 · Element Plus · Express · LangChain · MySQL · SSE</p>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { useAppStore } from '@/stores/app'

const route = useRoute()
const router = useRouter()
const user = useUserStore()
const app = useAppStore()

const navItems = [
  { path: '/', label: '行程规划', icon: 'MapLocation' },
  { path: '/chat', label: 'AI 对话', icon: 'ChatDotRound' },
  { path: '/my', label: '我的行程', icon: 'Collection' }
]

const activeMenu = computed(() => {
  if (route.path === '/detail') return '/'
  return route.path
})

const initial = computed(() => (user.nickname || '游').slice(0, 1))

const aboutVisible = ref(false)

const recentPlans = ref([])

const CITY_PALETTE = ['#f56c0a', '#15803d', '#8b5cf6', '#0d9488', '#dc2626', '#0284c7']

function planColor(city) {
  let hash = 0
  for (let i = 0; i < (city || '').length; i++) hash = (hash * 31 + city.charCodeAt(i)) >>> 0
  return CITY_PALETTE[hash % CITY_PALETTE.length]
}

function loadRecentPlans() {
  try {
    const raw = localStorage.getItem('recent_plans')
    recentPlans.value = raw ? JSON.parse(raw) : []
  } catch {
    recentPlans.value = []
  }
}

function goPlan(plan) {
  router.push({ path: '/', query: { city: plan.city, days: plan.days, budget: plan.budget } })
}

function onCommand(command) {
  if (command === 'logout') {
    ElMessageBox.confirm('确定退出登录吗？', '提示', { type: 'warning' })
      .then(() => {
        user.logout()
        router.push('/login')
      })
      .catch(() => {})
    return
  }
  if (command === 'profile') {
    router.push('/profile')
    return
  }
  if (command === 'about') aboutVisible.value = true
}

onMounted(loadRecentPlans)
</script>

<style scoped>
.layout {
  display: flex;
  height: 100%;
}

/* 左侧导航：杂志风渐变 */
.sidebar {
  width: var(--sidebar-width);
  background: linear-gradient(180deg, #f56c0a 0%, #dc2626 55%, #7c3aed 100%);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  color: #fff;
  padding: 20px 0;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 22px 22px;
  cursor: pointer;
}

.logo-text {
  display: flex;
  flex-direction: column;
}

.logo-name {
  color: #fff;
  font-size: 20px;
  font-weight: 800;
  letter-spacing: 1px;
  line-height: 1.1;
}

.logo-sub {
  color: rgba(255, 255, 255, 0.72);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.5px;
}

.nav-menu {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0 14px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 12px;
  color: rgba(255, 255, 255, 0.8);
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.nav-item.active {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

/* 最近规划 */
.recent-section {
  margin-top: auto;
  padding: 22px 18px 14px;
}

.recent-title {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 10px;
  padding-left: 6px;
}

.recent-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.recent-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 14px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.92);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}

.recent-item:hover {
  background: rgba(255, 255, 255, 0.18);
}

.recent-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.recent-empty {
  padding: 10px 14px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
}

.sidebar-footer {
  padding: 0 22px;
  margin-top: 10px;
}

.version {
  display: block;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}

.version-sub {
  display: block;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.3);
}

/* 右侧 */
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--color-bg);
}

.header {
  height: var(--header-height);
  background: var(--color-card);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 28px;
}

.header-title {
  font-size: 20px;
  font-weight: 700;
  margin: 0;
  color: var(--color-text);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.user-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 10px 4px 4px;
  border-radius: 999px;
  background: var(--color-bg);
  transition: background 0.2s;
}

.user-chip:hover {
  background: var(--color-hover);
}

.user-chip :deep(.el-avatar) {
  background: linear-gradient(135deg, #f56c0a, #dc2626);
  color: #fff;
  font-weight: 600;
}

.nickname {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

.content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.about {
  line-height: 1.8;
  text-align: center;
}

.about-tech {
  color: var(--color-text-secondary);
  font-size: 12px;
}
</style>
