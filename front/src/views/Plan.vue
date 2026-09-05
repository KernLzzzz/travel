<template>
  <div class="plan-page">
    <el-row :gutter="24">
      <!-- 左侧：规划表单 -->
      <el-col :xs="24" :md="9">
        <div class="card form-card">
          <div class="form-header">
            <h3 class="form-title">
              <el-icon><Star /></el-icon>
              开始规划
            </h3>
            <p class="form-tip">填得越细，行程越贴合你</p>
          </div>

          <el-form label-position="top">
            <el-form-item label="目的地城市">
              <el-select v-model="form.city" placeholder="选择或输入城市" filterable allow-create style="width: 100%">
                <el-option v-for="c in hotCities" :key="c" :label="c" :value="c" />
              </el-select>
            </el-form-item>

            <el-row :gutter="12">
              <el-col :span="12">
                <el-form-item label="出发地">
                  <el-input v-model="form.departure" placeholder="如：上海" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="目的地">
                  <el-input v-model="form.city" placeholder="如：成都" />
                </el-form-item>
              </el-col>
            </el-row>

            <el-form-item label="出发日期">
              <el-date-picker
                v-model="form.startDate"
                type="date"
                placeholder="影响季节推荐，建议填写"
                value-format="YYYY-MM-DD"
                :disabled-date="(d) => d.getTime() < Date.now() - 86400000"
                style="width: 100%"
              />
            </el-form-item>

            <el-row :gutter="12">
              <el-col :span="12">
                <el-form-item label="旅行天数">
                  <div class="step-input">
                    <el-button text @click="form.days = Math.max(1, form.days - 1)">−</el-button>
                    <span class="step-value">{{ form.days }} 天</span>
                    <el-button text @click="form.days = Math.min(15, form.days + 1)">+</el-button>
                  </div>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="出行人数">
                  <div class="step-input">
                    <el-button text @click="form.travelers = Math.max(1, form.travelers - 1)">−</el-button>
                    <span class="step-value">{{ form.travelers }} 人</span>
                    <el-button text @click="form.travelers = Math.min(20, form.travelers + 1)">+</el-button>
                  </div>
                </el-form-item>
              </el-col>
            </el-row>

            <el-form-item label="同行人">
              <div class="companion-options">
                <button
                  v-for="c in companionOptions"
                  :key="c"
                  type="button"
                  class="companion-btn"
                  :class="{ active: form.companion === c }"
                  @click="form.companion = form.companion === c ? '' : c"
                >
                  {{ c }}
                </button>
              </div>
            </el-form-item>

            <el-form-item label="总预算（含往返大交通）">
              <div class="budget-row">
                <el-slider v-model="form.budget" :min="500" :max="20000" :step="500" style="flex: 1" />
                <span class="budget-value">¥{{ form.budget }}</span>
              </div>
              <div class="budget-presets">
                <span
                  v-for="b in [3000, 5000, 8000, 15000]"
                  :key="b"
                  class="preset-tag"
                  :class="{ active: form.budget === b }"
                  @click="form.budget = b"
                >
                  ¥{{ b / 1000 }}k
                </span>
              </div>
            </el-form-item>

            <el-form-item label="行程节奏">
              <el-radio-group v-model="form.pacing" class="pacing-group">
                <el-radio-button v-for="p in pacingOptions" :key="p" :value="p">{{ p }}</el-radio-button>
              </el-radio-group>
            </el-form-item>

            <el-form-item label="主题偏好（可多选）">
              <div class="theme-options">
                <button
                  v-for="t in themeOptions"
                  :key="t"
                  type="button"
                  class="theme-btn"
                  :class="{ active: form.themes.includes(t) }"
                  @click="toggleTheme(t)"
                >
                  {{ t }}
                </button>
              </div>
            </el-form-item>

            <el-form-item label="其他要求（选填）">
              <el-input
                v-model="form.preference"
                placeholder="如：不想爬山、想吃地道苍蝇馆子、避开人流高峰…"
                maxlength="100"
                show-word-limit
                type="textarea"
                :rows="2"
              />
            </el-form-item>
          </el-form>

          <div class="hot-cities">
            <span class="hot-label">热门：</span>
            <el-tag
              v-for="c in hotCities.slice(0, 8)"
              :key="c"
              class="hot-tag"
              size="small"
              :type="form.city === c ? 'primary' : 'info'"
              round
              @click="form.city = c"
            >
              {{ c }}
            </el-tag>
          </div>

          <el-button
            v-if="!generating"
            type="primary"
            size="large"
            class="generate-btn"
            :disabled="!form.city"
            @click="generate"
          >
            <el-icon style="margin-right: 6px"><Promotion /></el-icon>
            开始规划
          </el-button>
          <el-button v-else type="danger" size="large" plain class="generate-btn" @click="cancel">
            停止生成
          </el-button>
        </div>
      </el-col>

      <!-- 右侧：渐进式渲染区 -->
      <el-col :xs="24" :md="15">
        <!-- 未开始 -->
        <div v-if="!started" class="card empty-card">
          <div class="empty-icon">
            <el-icon :size="56" color="#fff"><MapLocation /></el-icon>
          </div>
          <h3>让 AI 为你规划</h3>
          <p class="empty-desc">
            在左侧填写目的地、预算和天数，AI 会为你生成详细的每日行程。<br />
            <strong>生成过程是流式的 —— 行程卡片会一张张实时出现。</strong>
          </p>
        </div>

        <!-- 生成中 / 已完成 -->
        <div v-else ref="resultRef" class="result-area">
          <!-- 状态条 -->
          <div class="status-bar" :class="{ done: doneState }">
            <template v-if="generating">
              <el-icon class="is-loading"><Loading /></el-icon>
              <span>{{ statusText }}</span>
            </template>
            <template v-else-if="doneState">
              <el-icon color="var(--color-success)"><CircleCheckFilled /></el-icon>
              <span>行程生成完成 · 共 {{ partial.dailyItinerary.length }} 个地点</span>
            </template>
          </div>

          <!-- 行程总览 -->
          <div v-if="partial.summary || partial.city" class="card summary-card">
            <div class="summary-main">
              <div>
                <h2 class="summary-title">{{ partial.city || form.city }} {{ partial.days || form.days }} 日慢游</h2>
                <p v-if="partial.summary" class="summary-text">{{ partial.summary }}</p>
                <div class="summary-tags">
                  <span class="summary-tag">{{ form.departure || '出发地' }} → {{ partial.city || form.city }}</span>
                  <span v-if="form.startDate" class="summary-tag">{{ form.startDate }} 出发</span>
                  <span class="summary-tag">{{ form.travelers }} 人 · {{ form.companion || '独自' }}</span>
                </div>
              </div>
              <div class="summary-budget">
                <span class="budget-label">预算</span>
                <span class="budget-amount">¥{{ partial.totalBudget || form.budget }}</span>
              </div>
            </div>
          </div>

          <!-- 每日行程卡片 -->
          <transition-group name="fade-up">
            <div v-for="(day, dayIndex) in partial.dailyItinerary" :key="day.day" class="card day-card">
              <div class="day-header">
                <span class="day-badge" :class="`day-badge-${(day.day - 1) % 3}`">第 {{ day.day }} 天</span>
                <span class="day-theme">{{ day.theme || '' }}</span>
              </div>
              <SpotItem
                period="morning"
                :data="day.morning"
                :swappable="doneState"
                :swapping="swappingKey === dayIndex + '-morning'"
                @swap="handleSwap(dayIndex, 'morning')"
              />
              <SpotItem
                period="afternoon"
                :data="day.afternoon"
                :swappable="doneState"
                :swapping="swappingKey === dayIndex + '-afternoon'"
                @swap="handleSwap(dayIndex, 'afternoon')"
              />
              <SpotItem
                period="evening"
                :data="day.evening"
                :swappable="doneState"
                :swapping="swappingKey === dayIndex + '-evening'"
                @swap="handleSwap(dayIndex, 'evening')"
              />
            </div>
          </transition-group>

          <!-- 生成中占位 -->
          <div v-if="generating" class="card skeleton-card">
            <el-icon class="is-loading" :size="20"><Loading /></el-icon>
            <span>正在规划第 {{ partial.dailyItinerary.length + 1 }} 天…</span>
            <span class="cursor">▌</span>
          </div>

          <!-- 完成后的操作 -->
          <div v-if="doneState" class="done-actions">
            <el-button type="primary" size="large" class="done-btn-primary" @click="goDetail">
              <el-icon style="margin-right: 6px"><View /></el-icon>
              查看完整行程
            </el-button>
            <el-button size="large" :disabled="saved" class="done-btn" @click="save">
              <el-icon style="margin-right: 6px"><FolderAdd /></el-icon>
              {{ saved ? '已保存' : '保存到我的行程' }}
            </el-button>
            <el-button text size="large" @click="reset">重新规划</el-button>
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import SpotItem from '@/components/SpotItem.vue'
import { readSSE, createAborter, extractPartialItinerary } from '@/utils/sse'
import { getMeta, swapSpot } from '@/api/travel'
import { saveItinerary } from '@/api/itinerary'
import { useUserStore } from '@/stores/user'
import { usePlanStore } from '@/stores/plan'
import { companionOptions, themeOptions, pacingOptions } from '@/constants/travel'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const planStore = usePlanStore()

/* ---------- 表单 ---------- */
const form = reactive({
  city: '',
  departure: '上海',
  budget: 5000,
  days: 3,
  startDate: '',
  travelers: 2,
  companion: '',
  pacing: '适中',
  themes: [],
  preference: ''
})

const hotCities = ref([])

/* ---------- 生成状态 ---------- */
const started = ref(false)
const generating = ref(false)
const doneState = ref(false)
const saved = ref(false)

const rawText = ref('')
const partial = ref({ dailyItinerary: [] })
const itinerary = ref(null)

const resultRef = ref(null)
let aborter = null
let parseTimer = null

const statusText = computed(() => {
  if (partial.value.dailyItinerary.length === 0) return 'AI 正在分析需求…'
  return `正在生成第 ${partial.value.dailyItinerary.length + 1} 天的行程…`
})

function toggleTheme(t) {
  const idx = form.themes.indexOf(t)
  if (idx > -1) form.themes.splice(idx, 1)
  else form.themes.push(t)
}

function saveRecentPlan() {
  if (!itinerary.value) return
  try {
    const plans = JSON.parse(localStorage.getItem('recent_plans') || '[]')
    const next = {
      city: itinerary.value.city,
      days: itinerary.value.days,
      budget: itinerary.value.totalBudget,
      time: Date.now()
    }
    const filtered = plans.filter((p) => !(p.city === next.city && p.days === next.days))
    filtered.unshift(next)
    localStorage.setItem('recent_plans', JSON.stringify(filtered.slice(0, 5)))
  } catch {
    // ignore
  }
}

function scheduleParse() {
  if (parseTimer) return
  parseTimer = setTimeout(() => {
    parseTimer = null
    partial.value = extractPartialItinerary(rawText.value)
    scrollToBottom()
  }, 60)
}

async function scrollToBottom() {
  await nextTick()
  if (resultRef.value) {
    resultRef.value.scrollTop = resultRef.value.scrollHeight
  }
}

async function generate() {
  if (!form.city) return

  started.value = true
  generating.value = true
  doneState.value = false
  saved.value = false
  rawText.value = ''
  partial.value = { dailyItinerary: [] }
  itinerary.value = null

  aborter = createAborter()

  try {
    const final = await readSSE({
      url: '/api/travel/recommend',
      body: { ...form },
      token: userStore.token,
      signal: aborter.signal,
      onEvent: (event, data) => {
        if (event === 'chunk') {
          rawText.value += data.content
          scheduleParse()
        }
      }
    })

    if (final?.event === 'done') {
      itinerary.value = final.data.itinerary
      planStore.setItinerary(itinerary.value)
      doneState.value = true
      saveRecentPlan()
      ElMessage.success('行程生成完成')
    } else if (final?.event === 'error') {
      ElMessage.error(final.data?.message || '生成失败，请重试')
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      ElMessage.error(err.message || '生成失败，请重试')
    }
  } finally {
    generating.value = false
    partial.value = extractPartialItinerary(rawText.value)
  }
}

function cancel() {
  aborter?.abort()
  generating.value = false
}

const swappingKey = ref('')

async function handleSwap(dayIndex, period) {
  const day = partial.value.dailyItinerary?.[dayIndex]
  const slot = day?.[period]
  if (!itinerary.value || !slot?.spot || swappingKey.value) return

  swappingKey.value = `${dayIndex}-${period}`
  try {
    const avoidSpots = []
    partial.value.dailyItinerary.forEach((d) => {
      ;['morning', 'afternoon', 'evening'].forEach((p) => {
        if (d[p]?.spot && !(d === day && p === period)) avoidSpots.push(d[p].spot)
      })
    })

    const res = await swapSpot({
      city: itinerary.value.city,
      days: itinerary.value.days,
      budget: itinerary.value.totalBudget,
      day: day.day,
      theme: day.theme,
      period,
      current: { spot: slot.spot, description: slot.description },
      avoidSpots,
      companion: form.companion || undefined,
      themes: form.themes.length ? form.themes : undefined,
      preference: form.preference || undefined
    })

    const next = res.data?.slot
    if (!next?.spot) return

    partial.value.dailyItinerary[dayIndex][period] = next
    if (itinerary.value.dailyItinerary?.[dayIndex]) {
      itinerary.value.dailyItinerary[dayIndex][period] = next
    }
    planStore.setItinerary(itinerary.value)
    ElMessage.success(`已换成「${next.spot}」`)
  } catch {
    // 错误提示由拦截器统一处理
  } finally {
    swappingKey.value = ''
  }
}

function goDetail() {
  router.push('/detail')
}

async function save() {
  if (!itinerary.value) return
  try {
    await saveItinerary({
      city: itinerary.value.city,
      budget: itinerary.value.totalBudget,
      days: itinerary.value.days,
      content: itinerary.value
    })
    saved.value = true
    ElMessage.success('已保存到「我的行程」')
  } catch {
    // 错误提示由拦截器统一处理
  }
}

function reset() {
  started.value = false
  doneState.value = false
  rawText.value = ''
  partial.value = { dailyItinerary: [] }
  itinerary.value = null
  swappingKey.value = ''
}

onMounted(async () => {
  try {
    const res = await getMeta()
    hotCities.value = res.data?.hotCities || []
  } catch {
    hotCities.value = ['北京', '上海', '成都', '杭州', '西安', '三亚']
  }

  const { city, budget, days, auto } = route.query
  if (city) {
    form.city = String(city)
    if (budget) form.budget = Number(budget)
    if (days) form.days = Number(days)
    if (auto === '1') generate()
    return
  }

  await userStore.fetchProfile()
  const pref = userStore.userInfo?.preferences
  if (!pref) return
  if (pref.homeCity) form.city = pref.homeCity
  if (pref.defaultBudget) form.budget = pref.defaultBudget
  if (pref.defaultDays) form.days = pref.defaultDays
  if (pref.defaultTravelers) form.travelers = pref.defaultTravelers
  if (pref.companion) form.companion = pref.companion
  if (pref.pacing) form.pacing = pref.pacing
  if (Array.isArray(pref.themes) && pref.themes.length) form.themes = pref.themes
  if (pref.defaultPreference) form.preference = pref.defaultPreference
})

onUnmounted(() => {
  aborter?.abort()
  if (parseTimer) clearTimeout(parseTimer)
})
</script>

<style scoped>
.form-header {
  margin-bottom: 20px;
}

.form-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 4px;
}

.form-tip {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin: 0;
}

:deep(.el-form-item__label) {
  font-weight: 600;
  color: var(--color-text);
}

:deep(.el-input__wrapper),
:deep(.el-textarea__inner),
:deep(.el-select .el-input__wrapper) {
  border-radius: 12px;
}

/* 步进输入 */
.step-input {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  height: 40px;
  border-radius: 12px;
  border: 1px solid var(--color-border);
  background: #fff;
}

.step-value {
  font-weight: 700;
  font-size: 14px;
}

/* 同行人选项 */
.companion-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.companion-btn {
  padding: 7px 14px;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: #fff;
  color: var(--color-text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.companion-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.companion-btn.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}

/* 预算 */
.budget-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.budget-value {
  font-size: 18px;
  font-weight: 800;
  color: var(--color-primary);
  min-width: 72px;
  text-align: right;
}

.budget-presets {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.preset-tag {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  color: var(--color-text-secondary);
  background: var(--color-bg);
  cursor: pointer;
  transition: all 0.2s;
}

.preset-tag:hover,
.preset-tag.active {
  background: var(--color-primary-light);
  color: var(--color-primary);
  font-weight: 600;
}

:deep(.el-slider__runway) {
  margin: 10px 0;
}

:deep(.el-slider__bar) {
  background: linear-gradient(90deg, #f56c0a, #f59e0b);
}

:deep(.el-slider__button) {
  border-color: var(--color-primary);
}

/* 节奏 */
.pacing-group {
  width: 100%;
}

:deep(.pacing-group .el-radio-button__inner) {
  width: 100%;
}

/* 主题 */
.theme-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.theme-btn {
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: #fff;
  color: var(--color-text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.theme-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.theme-btn.active {
  background: var(--color-forest);
  border-color: var(--color-forest);
  color: #fff;
}

/* 热门城市 */
.hot-cities {
  margin: 8px 0 18px;
}

.hot-label {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-right: 6px;
}

.hot-tag {
  margin: 0 6px 6px 0;
  cursor: pointer;
  border-radius: 999px;
}

.generate-btn {
  width: 100%;
  height: 46px;
  font-size: 15px;
  letter-spacing: 2px;
  border-radius: 12px;
}

/* 空状态 */
.empty-card {
  min-height: 520px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.empty-icon {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background: linear-gradient(135deg, #f56c0a, #f59e0b);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  box-shadow: 0 12px 32px rgba(245, 108, 10, 0.25);
}

.empty-card h3 {
  margin: 0 0 10px;
  font-size: 20px;
}

.empty-desc {
  color: var(--color-text-secondary);
  line-height: 1.8;
  font-size: 13px;
}

/* 结果区 */
.result-area {
  max-height: calc(100vh - 140px);
  overflow-y: auto;
  padding-right: 4px;
}

.status-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
  border-radius: var(--radius-sm);
  background: var(--color-primary-light);
  color: var(--color-primary);
  font-size: 13px;
  font-weight: 600;
  position: sticky;
  top: 0;
  z-index: 2;
}

.status-bar.done {
  background: var(--color-forest-light);
  color: var(--color-forest);
}

.summary-card {
  margin-bottom: 16px;
}

.summary-main {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
}

.summary-title {
  font-size: 22px;
  font-weight: 800;
  margin: 0 0 8px;
}

.summary-text {
  color: var(--color-text-secondary);
  margin: 0 0 12px;
  line-height: 1.7;
  max-width: 520px;
}

.summary-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.summary-tag {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  color: var(--color-text-secondary);
  background: var(--color-bg);
}

.summary-budget {
  text-align: right;
  display: flex;
  flex-direction: column;
}

.budget-label {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.budget-amount {
  font-size: 26px;
  font-weight: 800;
  color: var(--color-primary);
}

.day-card {
  margin-bottom: 16px;
}

.day-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--color-border-light);
  margin-bottom: 6px;
}

.day-badge {
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  padding: 4px 12px;
  border-radius: 8px;
}

.day-badge-0 {
  background: var(--color-primary);
}

.day-badge-1 {
  background: var(--color-forest);
}

.day-badge-2 {
  background: var(--color-lilac);
}

.day-theme {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text);
}

.skeleton-card {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.cursor {
  color: var(--color-primary);
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.done-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  padding: 10px 0 20px;
}

.done-btn-primary {
  border-radius: 12px;
}

.done-btn {
  border-radius: 12px;
}

/* 卡片入场动画 */
.fade-up-enter-active {
  transition: all 0.4s ease;
}

.fade-up-enter-from {
  opacity: 0;
  transform: translateY(16px);
}
</style>
