<template>
  <div class="profile-page">
    <div class="page-head">
      <div>
        <h2 class="page-title">个人中心</h2>
        <p class="page-subtitle">管理你的资料与旅行偏好，让 AI 更懂你</p>
      </div>
    </div>

    <el-row :gutter="20">
      <!-- 左列：基本资料 + 修改密码 -->
      <el-col :xs="24" :md="10">
        <div class="card section-card">
          <h3 class="card-title">
            <el-icon><User /></el-icon>
            基本资料
          </h3>
          <el-form label-position="top">
            <el-form-item label="用户名">
              <el-input :model-value="user.userInfo?.username" disabled />
            </el-form-item>
            <el-form-item label="昵称">
              <el-input v-model="baseForm.nickname" maxlength="20" placeholder="给自己起个昵称" />
            </el-form-item>
            <el-form-item label="头像 URL（选填）">
              <el-input v-model="baseForm.avatar" placeholder="https://example.com/avatar.png" />
            </el-form-item>
          </el-form>
          <div class="preview-row" v-if="baseForm.avatar || user.userInfo?.nickname">
            <el-avatar :size="40" :src="baseForm.avatar || ''">{{ initial }}</el-avatar>
            <span class="preview-name">{{ baseForm.nickname || user.userInfo?.username }}</span>
          </div>
          <el-button type="primary" :loading="baseSaving" @click="saveBase">保存资料</el-button>
        </div>

        <div class="card section-card">
          <h3 class="card-title">
            <el-icon><Lock /></el-icon>
            修改密码
          </h3>
          <el-form label-position="top">
            <el-form-item label="当前密码">
              <el-input v-model="pwdForm.old" type="password" show-password placeholder="输入当前密码" />
            </el-form-item>
            <el-form-item label="新密码">
              <el-input v-model="pwdForm.next" type="password" show-password placeholder="不少于 6 位" />
            </el-form-item>
            <el-form-item label="确认新密码">
              <el-input v-model="pwdForm.confirm" type="password" show-password placeholder="再输入一次新密码" @keyup.enter="changePwd" />
            </el-form-item>
          </el-form>
          <el-button :loading="pwdSaving" @click="changePwd">确认修改</el-button>
        </div>
      </el-col>

      <!-- 右列：旅行偏好档案 -->
      <el-col :xs="24" :md="14">
        <div class="card section-card">
          <h3 class="card-title">
            <el-icon><Compass /></el-icon>
            旅行偏好档案
          </h3>
          <p class="pref-tip">
            <el-icon :size="13"><InfoFilled /></el-icon>
            保存后，规划页表单会按这份档案自动预填，AI 也会参考它生成更贴合你的行程。
          </p>

          <el-form label-position="top">
            <el-row :gutter="12">
              <el-col :span="12">
                <el-form-item label="常驻城市">
                  <el-select
                    v-model="prefForm.homeCity"
                    placeholder="选择或输入城市"
                    filterable
                    allow-create
                    clearable
                    style="width: 100%"
                  >
                    <el-option v-for="c in hotCityOptions" :key="c" :label="c" :value="c" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="同行人">
                  <el-select v-model="prefForm.companion" placeholder="常与谁同行" clearable style="width: 100%">
                    <el-option v-for="c in companionOptions" :key="c" :label="c" :value="c" />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>

            <el-row :gutter="12">
              <el-col :span="8">
                <el-form-item label="默认预算（元）">
                  <el-input-number v-model="prefForm.defaultBudget" :min="500" :max="100000" :step="500" style="width: 100%" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="默认天数">
                  <el-input-number v-model="prefForm.defaultDays" :min="1" :max="15" style="width: 100%" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="默认人数">
                  <el-input-number v-model="prefForm.defaultTravelers" :min="1" :max="20" style="width: 100%" />
                </el-form-item>
              </el-col>
            </el-row>

            <el-form-item label="行程节奏">
              <el-radio-group v-model="prefForm.pacing">
                <el-radio-button v-for="p in pacingOptions" :key="p" :value="p">{{ p }}</el-radio-button>
              </el-radio-group>
            </el-form-item>

            <el-form-item label="兴趣主题（可多选）">
              <el-select
                v-model="prefForm.themes"
                multiple
                collapse-tags
                collapse-tags-tooltip
                placeholder="AI 会优先安排与主题匹配的地点"
                style="width: 100%"
              >
                <el-option v-for="t in themeOptions" :key="t" :label="t" :value="t" />
              </el-select>
            </el-form-item>

            <el-form-item label="默认补充要求（选填）">
              <el-input
                v-model="prefForm.defaultPreference"
                placeholder="如：不吃辣、住地铁沿线…每次规划会自动带入"
                maxlength="100"
                show-word-limit
              />
            </el-form-item>
          </el-form>

          <el-button type="primary" :loading="prefSaving" @click="savePrefs">保存偏好</el-button>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { updateProfile, updatePreferences, changePassword } from '@/api/auth'
import { companionOptions, themeOptions, pacingOptions, hotCityOptions } from '@/constants/travel'

const user = useUserStore()

const initial = computed(() => (user.nickname || '游').slice(0, 1))

/* ---------- 基本资料 ---------- */
const baseForm = reactive({ nickname: '', avatar: '' })
const baseSaving = ref(false)

async function saveBase() {
  baseSaving.value = true
  try {
    await user.updateProfile({ nickname: baseForm.nickname, avatar: baseForm.avatar })
    ElMessage.success('资料已更新')
  } catch {
    // 拦截器统一提示
  } finally {
    baseSaving.value = false
  }
}

/* ---------- 旅行偏好档案 ---------- */
const prefForm = reactive({
  homeCity: '',
  defaultBudget: 5000,
  defaultDays: 3,
  defaultTravelers: 2,
  companion: '',
  pacing: '适中',
  themes: [],
  defaultPreference: ''
})
const prefSaving = ref(false)

function fillPrefForm(pref) {
  if (!pref) return
  if (pref.homeCity) prefForm.homeCity = pref.homeCity
  if (pref.defaultBudget) prefForm.defaultBudget = pref.defaultBudget
  if (pref.defaultDays) prefForm.defaultDays = pref.defaultDays
  if (pref.defaultTravelers) prefForm.defaultTravelers = pref.defaultTravelers
  if (pref.companion) prefForm.companion = pref.companion
  if (pref.pacing) prefForm.pacing = pref.pacing
  if (Array.isArray(pref.themes)) prefForm.themes = pref.themes
  if (pref.defaultPreference) prefForm.defaultPreference = pref.defaultPreference
}

async function savePrefs() {
  prefSaving.value = true
  try {
    await updatePreferences({ ...prefForm })
    // 同步到本地 userInfo，让规划页立即可读
    user.userInfo = { ...user.userInfo, preferences: { ...prefForm } }
    localStorage.setItem('userInfo', JSON.stringify(user.userInfo))
    ElMessage.success('偏好已保存，下次规划将自动预填')
  } catch {
    // 拦截器统一提示
  } finally {
    prefSaving.value = false
  }
}

/* ---------- 修改密码 ---------- */
const pwdForm = reactive({ old: '', next: '', confirm: '' })
const pwdSaving = ref(false)

async function changePwd() {
  if (!pwdForm.old || !pwdForm.next) {
    ElMessage.warning('请填写当前密码与新密码')
    return
  }
  if (pwdForm.next.length < 6) {
    ElMessage.warning('新密码长度不能少于 6 位')
    return
  }
  if (pwdForm.next !== pwdForm.confirm) {
    ElMessage.warning('两次输入的新密码不一致')
    return
  }

  pwdSaving.value = true
  try {
    await changePassword({ oldPassword: pwdForm.old, newPassword: pwdForm.next })
    ElMessage.success('密码修改成功')
    pwdForm.old = ''
    pwdForm.next = ''
    pwdForm.confirm = ''
  } catch {
    // 拦截器统一提示
  } finally {
    pwdSaving.value = false
  }
}

onMounted(async () => {
  // 拉最新资料（含偏好档案），静默失败时回退 localStorage 里的旧数据
  await user.fetchProfile()
  baseForm.nickname = user.userInfo?.nickname || ''
  baseForm.avatar = user.userInfo?.avatar || ''
  fillPrefForm(user.userInfo?.preferences)
})
</script>

<style scoped>
.page-head {
  margin-bottom: 8px;
}

.section-card {
  margin-bottom: 20px;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  margin: 0 0 16px;
}

.preview-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  padding: 10px 12px;
  background: var(--color-hover);
  border-radius: var(--radius-sm);
}

.preview-name {
  font-size: 14px;
  font-weight: 600;
}

.pref-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-text-secondary);
  background: var(--color-primary-light);
  color: var(--color-primary);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
  margin: 0 0 16px;
  line-height: 1.6;
}
</style>
