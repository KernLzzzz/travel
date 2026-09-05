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
          注册后即可保存行程与对话历史，<br />
          让 AI 记住你的旅行偏好。
        </p>
      </div>

      <div class="hero-tags">
        <span class="hero-tag">智能规划</span>
        <span class="hero-tag">预算可控</span>
        <span class="hero-tag">实时对话</span>
      </div>

      <div class="deco-circle deco-circle-1" />
      <div class="deco-circle deco-circle-2" />
      <div class="deco-block" />
    </div>

    <!-- 右侧表单区 -->
    <div class="auth-form-panel">
      <div class="auth-card">
        <div class="auth-header">
          <h2 class="auth-title">创建账号</h2>
          <p class="auth-sub">注册后即可保存行程与对话历史</p>
        </div>

        <el-form ref="formRef" :model="form" :rules="rules" size="large" @submit.prevent>
          <el-form-item prop="username" label="用户名">
            <el-input v-model="form.username" placeholder="用户名（3-20 位字母数字下划线）" :prefix-icon="User" />
          </el-form-item>
          <el-form-item prop="nickname" label="昵称">
            <el-input v-model="form.nickname" placeholder="昵称（选填）" :prefix-icon="Avatar" />
          </el-form-item>
          <el-form-item prop="password" label="密码">
            <el-input v-model="form.password" type="password" placeholder="密码（至少 6 位）" show-password :prefix-icon="Lock" />
          </el-form-item>
          <el-form-item prop="confirm" label="确认密码">
            <el-input v-model="form.confirm" type="password" placeholder="确认密码" show-password :prefix-icon="Lock" @keyup.enter="submit" />
          </el-form-item>
          <el-button type="primary" class="auth-btn" :loading="loading" @click="submit">
            注 册
          </el-button>
        </el-form>

        <div class="auth-footer">
          已有账号？<router-link to="/login" class="auth-link">直接登录</router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock, Avatar } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()

const formRef = ref()
const loading = ref(false)
const form = reactive({ username: '', nickname: '', password: '', confirm: '' })

const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9_]{3,20}$/, message: '3-20 位，仅限字母、数字、下划线', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少 6 位', trigger: 'blur' }
  ],
  confirm: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value !== form.password) callback(new Error('两次输入的密码不一致'))
        else callback()
      },
      trigger: 'blur'
    }
  ]
}

async function submit() {
  await formRef.value.validate().catch(() => Promise.reject())
  loading.value = true
  try {
    await userStore.register({ username: form.username, password: form.password, nickname: form.nickname })
    ElMessage.success('注册成功，已自动登录')
    router.push('/')
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
  margin-bottom: 24px;
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
