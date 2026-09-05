<template>
  <div class="detail-page">
    <template v-if="itinerary">
      <!-- 页面顶栏：返回 + 标题 + 城市 chip + 分享/导出（对齐 P6 设计稿） -->
      <div class="detail-topbar">
        <div class="topbar-left">
          <el-button text class="topbar-back" @click="goBack">
            <el-icon :size="18"><ArrowLeft /></el-icon>
          </el-button>
          <h3 class="topbar-title">行程详情</h3>
          <span class="city-chip">{{ itinerary.city }} · {{ itinerary.days }}日游</span>
        </div>
        <div class="topbar-actions">
          <el-button class="topbar-btn" @click="shareTrip">
            <el-icon style="margin-right: 6px"><Share /></el-icon>
            分享行程
          </el-button>
          <el-button type="primary" class="topbar-btn" :loading="exporting" @click="exportPDF">
            <el-icon style="margin-right: 6px"><Download /></el-icon>
            导出 PDF
          </el-button>
        </div>
      </div>

      <div ref="exportRef" class="export-area">
        <!-- 修改状态条：存在未保存修改时显示 -->
        <div v-if="isModified" class="modify-bar">
          <div class="modify-left">
            <el-icon class="modify-check" :size="15"><CircleCheckFilled /></el-icon>
            <span>已修改 {{ changes.length }} 处</span>
            <span v-if="totalDelta !== 0" class="modify-delta">
              · 预算变化 {{ totalDelta > 0 ? '+' : '−' }}¥{{ Math.abs(totalDelta) }}
            </span>
          </div>
          <div class="modify-actions">
            <el-button text class="discard-btn" @click="discardChanges">放弃修改</el-button>
            <el-button type="primary" :loading="saving" @click="saveChanges">保存修改</el-button>
          </div>
        </div>

        <!-- 行程概览 -->
        <div class="card overview-card">
          <div class="overview-main">
            <div>
              <h2 class="overview-title">{{ itinerary.city }}{{ itinerary.days }}日游</h2>
              <p class="overview-summary">{{ itinerary.summary }}</p>
            </div>
            <div class="overview-budget">
              <span class="budget-label">总预算</span>
              <span class="budget-value">¥{{ displayBudget }}</span>
            </div>
          </div>
        </div>

        <el-row :gutter="20">
          <!-- 左列：每日行程 + 提示 -->
          <el-col :xs="24" :md="15">
            <div v-for="day in itinerary.dailyItinerary" :key="day.day" class="card day-card">
              <div class="day-header">
                <span class="day-badge" :class="`day-badge-${(day.day - 1) % 3}`">第 {{ day.day }} 天</span>
                <span class="day-theme">{{ day.theme }}</span>
                <span class="day-subtotal">当日小计 ¥{{ daySubtotal(day) }}</span>
              </div>
              <SpotItem
                v-for="p in periodKeys"
                :key="day.day + '-' + p"
                :period="p"
                :data="day[p]"
                swappable
                :swapping="swappingKey === day.day + '-' + p"
                :replaced="isSlotReplaced(day, p)"
                :original-spot="originalOf(day, p)?.spot || ''"
                :original-ticket="originalOf(day, p)?.ticket || ''"
                @swap="handleSwap(day, p)"
                @undo="undoChange(day, p)"
              />
            </div>
          </el-col>

          <!-- 右列：预算变化 / 修改记录 / 预算分配 / 实用提示 / 注意事项 -->
          <el-col :xs="24" :md="9">
            <!-- 预算变化卡：换景点产生差额时显示 -->
            <div v-if="isModified" class="card budget-diff-card">
              <h4 class="section-title">
                <el-icon color="#f97316"><TrendCharts /></el-icon>
                预算变化
              </h4>
              <div class="diff-compare">
                <div class="diff-box">
                  <span class="diff-label">修改前</span>
                  <span class="diff-value">¥{{ customBudget }}</span>
                </div>
                <el-icon class="diff-arrow" :size="16"><Right /></el-icon>
                <div class="diff-box after">
                  <span class="diff-label">修改后</span>
                  <span class="diff-value">¥{{ displayBudget }}</span>
                </div>
              </div>

              <div class="diff-detail-list">
                <div v-for="(c, i) in changes" :key="i" class="diff-detail-row">
                  <span class="diff-spot">{{ c.next.spot }}</span>
                  <span class="diff-amount" :class="c.delta > 0 ? 'up' : c.delta < 0 ? 'down' : ''">
                    {{ c.delta > 0 ? '+' : c.delta < 0 ? '−' : '±' }}¥{{ Math.abs(c.delta) }}
                  </span>
                </div>
              </div>

              <span v-if="totalDelta !== 0" class="diff-chip" :class="totalDelta > 0 ? 'up' : 'down'">
                {{ totalDelta > 0 ? '+' : '−' }}¥{{ Math.abs(totalDelta) }}
              </span>
              <span v-else class="diff-chip flat">预算无变化</span>
            </div>

            <!-- 修改记录卡：逐条可撤销 -->
            <div v-if="isModified" class="card changes-card">
              <h4 class="section-title">
                <el-icon color="var(--color-text-secondary)"><Clock /></el-icon>
                修改记录
              </h4>
              <div v-for="(c, i) in changes" :key="i" class="change-row">
                <div class="change-info">
                  <div class="change-meta">{{ formatTime(c.time) }} · 第 {{ c.day.day }} 天 · {{ periodLabel(c.period) }}</div>
                  <div class="change-spots">
                    <span class="change-old">{{ c.original.spot }}</span>
                    <el-icon :size="11" class="change-arrow"><Right /></el-icon>
                    <span class="change-new">{{ c.next.spot }}</span>
                  </div>
                </div>
                <el-button text size="small" class="change-undo" @click="undoChange(c.day, c.period)">
                  撤销
                </el-button>
              </div>
            </div>

            <div class="card budget-card">
              <h4 class="section-title">
                <el-icon color="var(--color-primary)"><PieChart /></el-icon>
                预算分配
              </h4>

              <BudgetChart :breakdown="displayBreakdown" :total="displayBudget" />

              <div class="breakdown-list">
                <div v-for="(label, key) in breakdownLabels" :key="key" class="breakdown-row">
                  <span>{{ label }}</span>
                  <span class="amount">¥{{ displayBreakdown[key] }}</span>
                </div>
              </div>

              <!-- 预算联动：拖动滑块，本地实时重算分配 -->
              <div class="budget-adjuster">
                <div class="adjuster-title">
                  <el-icon><SetUp /></el-icon>
                  调整预算试试
                </div>
                <el-slider
                  v-model="customBudget"
                  :min="500"
                  :max="sliderMax"
                  :step="500"
                  :format-tooltip="(v) => `¥${v}`"
                />
                <div class="adjuster-hint" v-if="budgetChanged">
                  图表已按 ¥{{ customBudget }} 实时重算（各项按比例缩放）
                </div>
                <el-button
                  v-if="budgetChanged"
                  type="primary"
                  class="regenerate-btn"
                  @click="regenerate"
                >
                  <el-icon style="margin-right: 6px"><Refresh /></el-icon>
                  按 ¥{{ customBudget }} 重新生成行程
                </el-button>
              </div>
            </div>

            <!-- 实用提示 / 注意事项：右栏收尾（对齐 P6 设计稿） -->
            <div class="card tips-card" v-if="itinerary.tips?.length">
              <h4 class="section-title">
                <el-icon color="#faad14"><Star /></el-icon>
                实用提示
              </h4>
              <ul class="tips-list">
                <li v-for="(t, i) in itinerary.tips" :key="i">{{ t }}</li>
              </ul>
            </div>

            <div class="card tips-card" v-if="itinerary.warnings?.length">
              <h4 class="section-title">
                <el-icon color="var(--color-danger)"><Warning /></el-icon>
                注意事项
              </h4>
              <ul class="tips-list warning">
                <li v-for="(w, i) in itinerary.warnings" :key="i">{{ w }}</li>
              </ul>
            </div>
          </el-col>
        </el-row>
      </div>

      <!-- 底部操作栏：导出已移至顶栏，这里只保留保存/收藏/返回 -->
      <div class="action-bar">
        <!-- 有未保存修改时由顶部状态条接管保存，避免双入口 -->
        <el-button v-if="!savedItemHidden && !savedItem" type="primary" plain :disabled="saved" @click="save">
          <el-icon style="margin-right: 6px"><FolderAdd /></el-icon>
          {{ saved ? '已保存' : '保存到我的行程' }}
        </el-button>

        <el-button v-if="savedItem" :type="isFavorite ? 'warning' : 'default'" plain @click="toggleFav">
          <el-icon style="margin-right: 6px"><StarFilled v-if="isFavorite" /><Star v-else /></el-icon>
          {{ isFavorite ? '已收藏' : '收藏' }}
        </el-button>

        <el-button text @click="goBack">返回</el-button>
      </div>
    </template>

    <el-empty v-else description="暂无行程数据">
      <el-button type="primary" @click="router.push('/')">去规划一份行程</el-button>
    </el-empty>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import SpotItem from '@/components/SpotItem.vue'
import BudgetChart from '@/components/BudgetChart.vue'
import { getItinerary, saveItinerary, updateItinerary, toggleFavorite } from '@/api/itinerary'
import { swapSpot } from '@/api/travel'
import { usePlanStore } from '@/stores/plan'

const route = useRoute()
const router = useRouter()
const planStore = usePlanStore()

const itinerary = ref(null)
/** 已保存行程的 id（从「我的行程」进入时存在） */
const savedItem = ref(null)
const isFavorite = ref(false)
const saved = ref(false)
const exporting = ref(false)
const saving = ref(false)

const exportRef = ref(null)

const periodKeys = ['morning', 'afternoon', 'evening']
const periodNameMap = { morning: '上午', afternoon: '下午', evening: '晚上' }

const breakdownLabels = {
  accommodation: '住宿',
  food: '餐饮',
  transportation: '交通',
  tickets: '门票',
  other: '其他'
}

/* ---------- 预算联动（滑块重算 + 换景点差额） ---------- */
/** 加载时的原始预算与分配快照，作为比例缩放与「修改前」的基准 */
const originalBreakdown = ref({ accommodation: 0, food: 0, transportation: 0, tickets: 0, other: 0 })
const customBudget = ref(0)
const sliderMax = computed(() => Math.max(20000, (itinerary.value?.totalBudget || 0) * 3))

const budgetChanged = computed(
  () => itinerary.value && customBudget.value !== itinerary.value.totalBudget
)

/** 从「门票 120 元」「免费」「约 40 元含茶水」等文案中提取票价数字，免费/待定按 0 */
function parseTicketFee(ticket) {
  if (!ticket) return 0
  const match = String(ticket).match(/(\d+(?:\.\d+)?)/)
  return match ? Math.round(Number(match[1])) : 0
}

/* ---------- 换一个景点：本地修改暂存 ---------- */
/**
 * 未保存的修改列表
 * 每条：{ day, period, original(原时段数据), next(新时段数据), delta(票价差), time }
 * 换一个先改本地视图并记录，用户在状态条「保存修改」后才批量落库
 */
const changes = ref([])
/** 正在重生成的时段，格式 `${day.day}-${period}`，同时只允许一个请求 */
const swappingKey = ref('')

const isModified = computed(() => changes.value.length > 0)

/** 刚生成（未保存）且已有暂存修改时，隐藏底部「保存到我的行程」，由状态条统一接管保存 */
const savedItemHidden = computed(() => !savedItem.value && isModified.value)

/** 换景点产生的门票差额合计（正数为加价） */
const totalDelta = computed(() => changes.value.reduce((sum, c) => sum + c.delta, 0))

/** 生效总预算 = 滑块预算 + 换景点差额 */
const displayBudget = computed(() => (customBudget.value || 0) + totalDelta.value)

/** 预算分配：按滑块预算对原始分配等比缩放，门票项再叠加换景点差额 */
const displayBreakdown = computed(() => {
  const src = originalBreakdown.value || {}
  const target = customBudget.value || 0
  const sum = Object.values(src).reduce((a, b) => a + (Number(b) || 0), 0)

  const result = {}
  if (!sum || sum === target) {
    Object.keys(src).forEach((k) => (result[k] = Number(src[k]) || 0))
  } else {
    const ratio = target / sum
    let allocated = 0
    const keys = Object.keys(src)
    keys.forEach((key, idx) => {
      if (idx === keys.length - 1) {
        result[key] = target - allocated
      } else {
        result[key] = Math.round((Number(src[key]) || 0) * ratio)
        allocated += result[key]
      }
    })
  }

  // 门票项吸收换景点的票价差，保证加总仍等于生效总预算
  result.tickets = (result.tickets || 0) + totalDelta.value
  return result
})

function periodLabel(period) {
  return periodNameMap[period] || '时段'
}

/** 单日小计：三个时段票价之和 */
function daySubtotal(day) {
  return periodKeys.reduce((sum, p) => sum + parseTicketFee(day[p]?.ticket), 0)
}

function isSlotReplaced(day, period) {
  return changes.value.some((c) => c.day === day && c.period === period)
}

function originalOf(day, period) {
  const found = changes.value.find((c) => c.day === day && c.period === period)
  return found?.original || null
}

function formatTime(date) {
  const d = new Date(date)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/* ---------- 数据加载 ---------- */
onMounted(async () => {
  const id = route.query.id
  if (id) {
    // 从「我的行程」进入：拉取已保存的行程
    try {
      const res = await getItinerary(id)
      itinerary.value = res.data.content
      savedItem.value = res.data.id
      isFavorite.value = Boolean(res.data.is_favorite)
    } catch {
      itinerary.value = null
    }
  } else {
    // 刚生成的行程
    itinerary.value = planStore.getItinerary()
  }

  originalBreakdown.value = { ...(itinerary.value?.budgetBreakdown || {}) }
  customBudget.value = itinerary.value?.totalBudget || 0
})

/* ---------- 操作 ---------- */
async function save() {
  if (!itinerary.value) return
  try {
    const res = await saveItinerary({
      city: itinerary.value.city,
      budget: displayBudget.value,
      days: itinerary.value.days,
      content: buildContent()
    })
    savedItem.value = res.data?.id || null
    saved.value = true
    ElMessage.success('已保存到「我的行程」')
  } catch {
    // 拦截器统一提示
  }
}

/** 组装要落库的行程内容：写入生效预算，保证下次进入与展示一致 */
function buildContent() {
  return {
    ...itinerary.value,
    totalBudget: displayBudget.value,
    budgetBreakdown: { ...displayBreakdown.value }
  }
}

/** 保存修改：把暂存的换景点修改批量落库（已有行程更新，新行程创建） */
async function saveChanges() {
  if (!isModified.value || saving.value) return
  saving.value = true
  try {
    const content = buildContent()

    if (savedItem.value) {
      await updateItinerary(savedItem.value, { content, budget: displayBudget.value })
    } else {
      const res = await saveItinerary({
        city: itinerary.value.city,
        budget: displayBudget.value,
        days: itinerary.value.days,
        content
      })
      savedItem.value = res.data?.id || null
      saved.value = true
    }

    // 保存后以当前状态为新基准，状态条与修改记录清空
    itinerary.value.totalBudget = displayBudget.value
    itinerary.value.budgetBreakdown = { ...displayBreakdown.value }
    originalBreakdown.value = { ...displayBreakdown.value }
    customBudget.value = displayBudget.value
    changes.value = []

    ElMessage.success('修改已保存')
  } catch {
    // 拦截器统一提示
  } finally {
    saving.value = false
  }
}

/** 放弃修改：回滚全部暂存的替换 */
function discardChanges() {
  if (!isModified.value) return
  changes.value.forEach((c) => {
    c.day[c.period] = { ...c.original }
  })
  changes.value = []
  ElMessage.info('已放弃全部修改')
}

/** 撤销单条替换 */
function undoChange(day, period) {
  const idx = changes.value.findIndex((c) => c.day === day && c.period === period)
  if (idx === -1) return
  const [change] = changes.value.splice(idx, 1)
  day[period] = { ...change.original }
  ElMessage.success(`已恢复为「${change.original.spot}」`)
}

async function toggleFav() {
  try {
    const res = await toggleFavorite(savedItem.value)
    isFavorite.value = res.data.isFavorite
    ElMessage.success(res.message)
  } catch {
    // 拦截器统一提示
  }
}

/* ---------- 换一个景点 ---------- */
async function handleSwap(day, period) {
  const slot = day?.[period]
  if (!itinerary.value || !slot?.spot || swappingKey.value) return

  swappingKey.value = day.day + '-' + period
  try {
    // 行程里其他时段当前生效的地点（含已替换未保存的新地点），
    // 传给后端让模型避开，防止换出重复景点
    const avoidSpots = []
    itinerary.value.dailyItinerary.forEach((d) => {
      periodKeys.forEach((p) => {
        if (d[p]?.spot && !(d === day && p === period)) avoidSpots.push(d[p].spot)
      })
    })

    const res = await swapSpot({
      city: itinerary.value.city,
      days: itinerary.value.days,
      budget: displayBudget.value,
      day: day.day,
      theme: day.theme,
      period,
      current: { spot: slot.spot, description: slot.description },
      avoidSpots
    })

    const next = res.data?.slot
    if (!next?.spot) return

    // 记录暂存修改：替换视图 + 入修改记录，等用户点「保存修改」统一落库
    const original = { ...slot }
    day[period] = next
    changes.value.push({
      day,
      period,
      original,
      next,
      delta: parseTicketFee(next.ticket) - parseTicketFee(original.ticket),
      time: new Date()
    })

    ElMessage.success(`已换成「${next.spot}」，记得保存修改`)
  } catch {
    // 错误提示由拦截器统一处理
  } finally {
    swappingKey.value = ''
  }
}

/** 预算联动重规划：带着新预算跳回规划页并自动生成（有未保存修改时先确认） */
async function regenerate() {
  if (isModified.value) {
    try {
      await ElMessageBox.confirm('有未保存的修改，重新生成行程将丢弃这些修改。继续吗？', '重新生成行程', {
        type: 'warning',
        confirmButtonText: '继续',
        cancelButtonText: '返回'
      })
    } catch {
      return
    }
  }

  router.push({
    path: '/',
    query: {
      city: itinerary.value.city,
      budget: customBudget.value,
      days: itinerary.value.days,
      auto: '1'
    }
  })
}

/** 导出 PDF：html2canvas 截图 + jsPDF 分页输出 */
async function exportPDF() {
  if (!exportRef.value) return
  exporting.value = true
  try {
    const canvas = await html2canvas(exportRef.value, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true
    })
    const img = canvas.toDataURL('image/png')

    const pdf = new jsPDF('p', 'mm', 'a4')
    const pageWidth = 210
    const pageHeight = 297
    const imgWidth = pageWidth
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    let heightLeft = imgHeight
    let position = 0

    pdf.addImage(img, 'PNG', 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight

    while (heightLeft > 0) {
      position = heightLeft - imgHeight
      pdf.addPage()
      pdf.addImage(img, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
    }

    pdf.save(`${itinerary.value.city}${itinerary.value.days}日游-行程单.pdf`)
    ElMessage.success('PDF 已导出')
  } catch (err) {
    ElMessage.error('导出失败：' + err.message)
  } finally {
    exporting.value = false
  }
}

/* ---------- 分享行程 ---------- */
/** 组装分享文本：标题 / 预算 / 简介 / 每日安排 / 提示 / 未保存修改的差额明细 */
function buildShareText() {
  const lines = []
  lines.push(`${itinerary.value.city}${itinerary.value.days}日游 · 行程分享`)
  lines.push(`总预算：¥${displayBudget.value}`)
  if (itinerary.value.summary) {
    lines.push('', itinerary.value.summary)
  }

  lines.push('', '—— 每日安排 ——')
  itinerary.value.dailyItinerary.forEach((day) => {
    lines.push(`第 ${day.day} 天 · ${day.theme || ''}`)
    periodKeys.forEach((p) => {
      const slot = day[p]
      if (slot?.spot) {
        const fee = slot.ticket ? `（${slot.ticket}）` : ''
        lines.push(`  ${periodLabel(p)}：${slot.spot}${fee}`)
      }
    })
  })

  if (itinerary.value.tips?.length) {
    lines.push('', '—— 实用提示 ——')
    itinerary.value.tips.forEach((t) => lines.push(`- ${t}`))
  }

  if (itinerary.value.warnings?.length) {
    lines.push('', '—— 注意事项 ——')
    itinerary.value.warnings.forEach((w) => lines.push(`- ${w}`))
  }

  // 有未保存的换景点修改时附上差额明细，方便对方核对预算
  if (isModified.value) {
    lines.push('', '—— 待保存的修改（票价差额） ——')
    changes.value.forEach((c) => {
      const deltaText =
        c.delta === 0 ? '票价相同' : `票价差 ${c.delta > 0 ? '+' : '-'}¥${Math.abs(c.delta)}`
      lines.push(
        `第 ${c.day.day} 天 ${periodLabel(c.period)}：${c.original.spot} → ${c.next.spot}（${deltaText}）`
      )
    })
    lines.push(`合计差额：${totalDelta.value >= 0 ? '+' : '-'}¥${Math.abs(totalDelta.value)}`)
  }

  return lines.join('\n')
}

/** 剪贴板写入：优先 Clipboard API，非安全上下文退回 execCommand */
function copyText(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text)
  }
  return new Promise((resolve, reject) => {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    try {
      document.execCommand('copy')
      resolve()
    } catch (err) {
      reject(err)
    } finally {
      document.body.removeChild(ta)
    }
  })
}

/** 分享行程：格式化行程文本复制到剪贴板 */
async function shareTrip() {
  if (!itinerary.value) return
  try {
    await copyText(buildShareText())
    ElMessage.success('行程已复制到剪贴板，快去分享吧')
  } catch {
    ElMessage.error('复制失败，请检查浏览器剪贴板权限')
  }
}

function goBack() {
  router.back()
}
</script>

<style scoped>
/* 页面顶栏 */
.detail-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  background: var(--color-card);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
  padding: 12px 18px;
  margin-bottom: 18px;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.topbar-back {
  padding: 6px;
  color: var(--color-text);
}

.topbar-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
}

.city-chip {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-primary);
  background: var(--color-primary-light);
  border-radius: 999px;
  padding: 4px 12px;
  white-space: nowrap;
}

.topbar-actions {
  display: flex;
  gap: 10px;
}

.topbar-btn {
  border-radius: 10px;
}

.export-area {
  background: var(--color-bg);
  border-radius: var(--radius-md);
}

/* 修改状态条 */
.modify-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  background: var(--color-forest-light);
  border: 1px solid #bbf7d0;
  border-radius: 12px;
  padding: 12px 18px;
  margin-bottom: 18px;
}

.modify-left {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--color-forest);
}

.modify-check {
  color: var(--color-forest);
}

.modify-delta {
  font-weight: 700;
}

.modify-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.modify-actions .discard-btn {
  color: var(--color-text-secondary);
  border-radius: 10px;
}

.modify-actions :deep(.el-button--primary) {
  border-radius: 10px;
}

.overview-card {
  margin-bottom: 18px;
}

.overview-main {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
}

.overview-title {
  font-size: 24px;
  font-weight: 800;
  margin: 0 0 8px;
}

.overview-summary {
  color: var(--color-text-secondary);
  margin: 0;
  line-height: 1.7;
  max-width: 520px;
}

.overview-budget {
  text-align: right;
  display: flex;
  flex-direction: column;
}

.budget-label {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.budget-value {
  font-size: 28px;
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
  flex: 1;
}

.day-subtotal {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.tips-card {
  margin-bottom: 16px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 700;
  margin: 0 0 12px;
}

.tips-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.tips-list li {
  padding: 8px 0;
  color: var(--color-text-secondary);
  font-size: 13px;
  border-bottom: 1px solid var(--color-border-light);
  line-height: 1.6;
}

.tips-list li:last-child {
  border-bottom: none;
}

/* 预算变化卡 */
.budget-diff-card {
  margin-bottom: 16px;
}

.diff-compare {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.diff-box {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: var(--color-bg);
  border-radius: 10px;
  padding: 10px 12px;
}

.diff-box.after {
  background: var(--color-primary-light);
}

.diff-label {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.diff-value {
  font-size: 18px;
  font-weight: 800;
  color: var(--color-text);
}

.diff-box.after .diff-value {
  color: var(--color-primary);
}

.diff-arrow {
  color: var(--color-text-placeholder);
  flex-shrink: 0;
}

.diff-detail-list {
  border-top: 1px dashed var(--color-border-light);
  padding-top: 6px;
  margin-bottom: 10px;
}

.diff-detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 0;
  font-size: 13px;
}

.diff-spot {
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 12px;
}

.diff-amount {
  font-weight: 700;
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.diff-amount.up {
  color: var(--color-primary);
}

.diff-amount.down {
  color: var(--color-forest);
}

.diff-chip {
  display: inline-block;
  font-size: 12px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 999px;
}

.diff-chip.up {
  color: #fff;
  background: var(--color-primary);
}

.diff-chip.down {
  color: #fff;
  background: var(--color-forest);
}

.diff-chip.flat {
  color: var(--color-text-secondary);
  background: var(--color-bg);
}

/* 修改记录卡 */
.changes-card {
  margin-bottom: 16px;
}

.change-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px dashed var(--color-border-light);
}

.change-row:last-child {
  border-bottom: none;
}

.change-info {
  min-width: 0;
}

.change-meta {
  font-size: 12px;
  color: var(--color-text-placeholder);
  margin-bottom: 3px;
}

.change-spots {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  min-width: 0;
}

.change-old {
  color: var(--color-text-placeholder);
  text-decoration: line-through;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 110px;
}

.change-arrow {
  color: var(--color-text-placeholder);
  flex-shrink: 0;
}

.change-new {
  color: var(--color-primary);
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 110px;
}

.change-undo {
  color: var(--color-primary);
  flex-shrink: 0;
}

.budget-card {
  margin-bottom: 16px;
}

.breakdown-list {
  margin-top: 8px;
  border-top: 1px solid var(--color-border-light);
  padding-top: 10px;
}

.breakdown-row {
  display: flex;
  justify-content: space-between;
  padding: 5px 0;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.budget-adjuster {
  margin-top: 16px;
  padding: 14px;
  border-radius: var(--radius-sm);
  background: var(--color-primary-light);
}

.adjuster-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  color: var(--color-primary);
  margin-bottom: 6px;
}

.adjuster-hint {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 10px;
}

.regenerate-btn {
  width: 100%;
  border-radius: 10px;
}

.action-bar {
  display: flex;
  gap: 10px;
  justify-content: center;
  padding: 20px 0 10px;
}

:deep(.el-slider__bar) {
  background: linear-gradient(90deg, var(--color-primary), #f59e0b);
}

:deep(.el-slider__button) {
  border-color: var(--color-primary);
}
</style>
