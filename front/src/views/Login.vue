<template>
  <div class="auth-page">
    <!-- 左侧品牌区 -->
    <div class="auth-hero">
      <div class="hero-brand">
        <el-icon :size="28" color="#fff"><Guide /></el-icon>
        <span class="hero-brand-name">远行者</span>
        <span class="hero-brand-sub">AI Travel Planner</span>
      </div>

      <div class="hero-content">
        <h1 class="hero-title">出发吧</h1>
        <p class="hero-en">LET'S GO</p>
        <p class="hero-desc">
          告诉 AI 你想去哪、待几天、花多少，<br />
          剩下的交给它。
        </p>
      </div>

      <div class="hero-tags">
        <span class="hero-tag">智能规划</span>
        <span class="hero-tag">预算可控</span>
        <span class="hero-tag">实时对话</span>
      </div>

      <!-- 装饰色块 -->
      <div class="deco-circle deco-circle-1" />
      <div class="deco-circle deco-circle-2" />
      <div class="deco-block" />
    </div>

    <!-- 右侧表单区 -->
    <div class="auth-form-panel">
      <div class="auth-card">
        <div class="auth-header">
          <h2 class="auth-title">欢迎回来</h2>
          <p class="auth-sub">登录后继续你的旅行规划</p>
        </div>

        <el-form ref="formRef" :model="form" :rules="rules" size="large" @submit.prevent>
          <el-form-item prop="username" label="用户名">
            <el-input v-model="form.username" placeholder="请输入用户名" :prefix-icon="User" />
          </el-form-item>
          <el-form-item prop="password" label="密码">
            <el-input
              v-model="form.password"
              type="password"
              placeholder="请输入密码"
              show-password
              :prefix-icon="Lock"
              @keyup.enter="submit"
            />
          </el-form-item>
          <el-button type="primary" class="auth-btn" :loading="loading" @click="submit">
            登 录
          </el-button>
        </el-form>

        <div class="auth-footer">
          还没有账号？<router-link to="/register" class="auth-link">立即注册</router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const formRef = ref()
const loading = ref(false)
const form = reactive({ username: '', password: '' })

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

async function submit() {
  await formRef.value.validate().catch(() => Promise.reject())
  loading.value = true
  try {
    await userStore.login(form)
    ElMessage.success('登录成功')
    router.push(route.query.redirect || '/')
  } catch {
    // 错误提示由 axios 拦截器统一弹出
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
}

/* 左侧品牌区：杂志风渐变 */
.auth-hero {
  width: 46%;
  min-width: 420px;
  background: linear-gradient(135deg, #f56c0a 0%, #dc2626 45%, #7c3aed 100%);
  color: #fff;
  display: flex;
  flex-direction: column;
  padding: 48px;
  position: relative;
  overflow: hidden;
}

.hero-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  z-index: 1;
}

.hero-brand-name {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 1px;
}

.hero-brand-sub {
  font-size: 11px;
  opacity: 0.8;
  margin-left: 4px;
  padding-left: 8px;
  border-left: 1px solid rgba(255, 255, 255, 0.4);
}

.hero-content {
  margin-top: auto;
  margin-bottom: auto;
  z-index: 1;
}

.hero-title {
  font-size: 72px;
  font-weight: 800;
  margin: 0;
  letter-spacing: 2px;
  line-height: 1.1;
}

.hero-en {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 3px;
  margin: 12px 0 24px;
  opacity: 0.9;
}

.hero-desc {
  font-size: 15px;
  line-height: 1.8;
  opacity: 0.92;
  max-width: 360px;
}

.hero-tags {
  display: flex;
  gap: 10px;
  margin-top: 32px;
  z-index: 1;
}

.hero-tag {
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(4px);
}

/* 装饰图形 */
.deco-circle {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
}

.deco-circle-1 {
  width: 320px;
  height: 320px;
  top: 10%;
  right: -80px;
}

.deco-circle-2 {
  width: 160px;
  height: 160px;
  bottom: 18%;
  right: 12%;
  background: rgba(255, 255, 255, 0.18);
}

.deco-block {
  position: absolute;
  width: 140px;
  height: 140px;
  left: -40px;
  bottom: 12%;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.14);
  transform: rotate(15deg);
}

/* 右侧表单区 */
.auth-form-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background: var(--color-bg);
}

.auth-card {
  width: 100%;
  max-width: 420px;
}

.auth-header {
  margin-bottom: 28px;
}

.auth-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 6px;
}

.auth-sub {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin: 0;
}

.auth-btn {
  width: 100%;
  margin-top: 8px;
  height: 46px;
  font-size: 15px;
  letter-spacing: 3px;
  border-radius: 12px;
}

.auth-footer {
  margin-top: 22px;
  text-align: center;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.auth-link {
  color: var(--color-primary);
  text-decoration: none;
  font-weight: 600;
}

.auth-link:hover {
  text-decoration: underline;
}

/* 表单标签样式 */
:deep(.el-form-item__label) {
  font-weight: 600;
  color: var(--color-text);
}

:deep(.el-input__wrapper) {
  border-radius: 12px;
  box-shadow: 0 0 0 1px var(--color-border) inset;
}

:deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px var(--color-primary) inset;
}

@media (max-width: 860px) {
  .auth-hero {
    display: none;
  }
  .auth-form-panel {
    width: 100%;
  }
}
</style>
