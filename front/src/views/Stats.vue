<template>
  <div class="stats-page">
    <div class="page-head">
      <div>
        <h2 class="page-title">旅行足迹</h2>
        <p class="page-subtitle">你保存的每份行程，都在这里汇聚成走过的路</p>
      </div>
      <el-button @click="router.push('/my')">
        <el-icon style="margin-right: 6px"><Collection /></el-icon>
        查看我的行程
      </el-button>
    </div>

    <div v-loading="loading" class="stats-body">
      <!-- 空状态：还没有任何行程 -->
      <div v-if="!loading && stats.overview.tripCount === 0" class="card empty-card">
        <el-icon :size="48" color="var(--color-primary)"><Location /></el-icon>
        <h3>还没有旅行足迹</h3>
        <p class="empty-desc">
          完成第一次行程规划并保存后，这里会记录你走过的城市、<br />
          累计天数与预算投入，生成专属于你的旅行地图。
        </p>
        <el-button type="primary" @click="router.push('/')">去规划第一份行程</el-button>
      </div>

      <template v-else>
        <!-- 概览指标卡 -->
        <div class="overview-grid">
          <div v-for="s in overviewCards" :key="s.label" class="card stat-card">
            <div class="stat-icon" :style="{ background: s.bg, color: s.color }">
              <el-icon :size="22"><component :is="s.icon" /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ s.value }}</div>
              <div class="stat-label">{{ s.label }}</div>
              <div v-if="s.sub" class="stat-sub">{{ s.sub }}</div>
            </div>
          </div>
        </div>

        <!-- 图表区：城市分布 + 城市预算 -->
        <div class="charts-grid">
          <div class="card chart-card">
            <h4 class="chart-title">城市足迹分布</h4>
            <div ref="pieRef" class="chart-box" />
          </div>
          <div class="card chart-card">
            <h4 class="chart-title">各城市累计预算（元）</h4>
            <div ref="barRef" class="chart-box" />
          </div>
        </div>

        <!-- 最近足迹时间线 -->
        <div class="card recent-card">
          <h4 class="chart-title">最近足迹</h4>
          <el-timeline v-if="stats.recent.length" class="recent-timeline">
            <el-timeline-item
              v-for="item in stats.recent"
              :key="item.id"
              :timestamp="formatDate(item.created_at)"
              placement="top"
              type="primary"
            >
              <div class="recent-item" @click="open(item)">
                <span class="recent-title">{{ item.title }}</span>
                <span class="recent-meta">
                  <el-icon :size="13"><Location /></el-icon>{{ item.city }}
                  <el-icon :size="13"><Calendar /></el-icon>{{ item.days }} 天
                  <span class="amount">¥{{ formatMoney(item.budget) }}</span>
                </span>
              </div>
            </el-timeline-item>
          </el-timeline>
          <p v-else class="empty-text">暂无足迹记录</p>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts'
import { getStats } from '@/api/itinerary'
import { useAppStore } from '@/stores/app'

const router = useRouter()
const app = useAppStore()

const loading = ref(false)
const stats = reactive({
  overview: { tripCount: 0, totalDays: 0, totalBudget: 0, favoriteCount: 0 },
  cities: [],
  recent: []
})

/* ---------- 概览卡 ---------- */
const overviewCards = computed(() => [
  {
    icon: 'Collection',
    label: '累计行程',
    value: stats.overview.tripCount,
    sub: `收藏 ${stats.overview.favoriteCount} 份`,
    bg: 'var(--color-primary-light)',
    color: 'var(--color-primary)'
  },
  {
    icon: 'Location',
    label: '去过城市',
    value: stats.cities.length,
    sub: stats.cities.length ? `最常去：${stats.cities[0].city}` : '',
    bg: '#ecfdf5',
    color: '#059669'
  },
  {
    icon: 'Calendar',
    label: '累计旅行天数',
    value: stats.overview.totalDays,
    sub: '所有规划行程总长',
    bg: 'var(--color-primary-light)',
    color: 'var(--color-warning)'
  },
  {
    icon: 'Wallet',
    label: '累计规划预算',
    value: `¥${formatMoney(stats.overview.totalBudget)}`,
    sub: '所有行程预算合计',
    bg: '#fdf2f8',
    color: '#db2777'
  }
])

/* ---------- 图表 ---------- */
const pieRef = ref(null)
const barRef = ref(null)
let pieChart = null
let barChart = null

/** 深浅两套图表主题色，跟随全局 dark 状态切换 */
function chartTheme() {
  const dark = app.dark
  return {
    textColor: dark ? '#f9fafb' : '#1f2937',
    subTextColor: dark ? '#9ca3af' : '#6b7280',
    splitLineColor: dark ? '#374151' : '#e5e7eb',
    tooltipBg: dark ? '#1f2937' : '#ffffff',
    tooltipBorder: dark ? '#374151' : '#e5e7eb'
  }
}

const PALETTE = ['#f56c0a', '#15803d', '#8b5cf6', '#dc2626', '#0d9488', '#db2777', '#f59e0b', '#0284c7', '#ea580c', '#65a30d', '#9333ea', '#4f46e5']

function renderCharts() {
  if (!stats.cities.length) return

  const t = chartTheme()
  const tooltip = {
    backgroundColor: t.tooltipBg,
    borderColor: t.tooltipBorder,
    textStyle: { color: t.textColor }
  }

  // 饼图：各城市行程数占比
  if (pieRef.value) {
    if (!pieChart) pieChart = echarts.init(pieRef.value)
    pieChart.setOption({
      color: PALETTE,
      tooltip: { trigger: 'item', formatter: '{b}：{c} 次规划（{d}%）', ...tooltip },
      legend: {
        bottom: 0,
        icon: 'circle',
        itemWidth: 8,
        itemHeight: 8,
        textStyle: { color: t.subTextColor, fontSize: 12 }
      },
      series: [
        {
          type: 'pie',
          radius: ['42%', '68%'],
          center: ['50%', '44%'],
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 6, borderColor: t.tooltipBg, borderWidth: 2 },
          label: { color: t.subTextColor, fontSize: 12 },
          data: stats.cities.map((c) => ({ name: c.city, value: c.tripCount }))
        }
      ]
    })
  }

  // 横向条形图：各城市累计预算（升序排列，投入最多的在最上方）
  if (barRef.value) {
    if (!barChart) barChart = echarts.init(barRef.value)
    const sorted = [...stats.cities].sort((a, b) => a.totalBudget - b.totalBudget)
    barChart.setOption({
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        valueFormatter: (v) => `¥${formatMoney(v)}`,
        ...tooltip
      },
      grid: { left: 8, right: 24, top: 8, bottom: 8, containLabel: true },
      xAxis: {
        type: 'value',
        axisLabel: { color: t.subTextColor, fontSize: 12 },
        splitLine: { lineStyle: { color: t.splitLineColor } }
      },
      yAxis: {
        type: 'category',
        data: sorted.map((c) => c.city),
        axisLabel: { color: t.textColor, fontSize: 12 },
        axisLine: { show: false },
        axisTick: { show: false }
      },
      series: [
        {
          type: 'bar',
          data: sorted.map((c) => c.totalBudget),
          barMaxWidth: 18,
          itemStyle: {
            borderRadius: [0, 6, 6, 0],
            color: {
              type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
              colorStops: [
                { offset: 0, color: '#f59e0b' },
                { offset: 1, color: '#f56c0a' }
              ]
            }
          },
          label: {
            show: true,
            position: 'right',
            color: t.subTextColor,
            fontSize: 11,
            formatter: (p) => `¥${formatMoney(p.value)}`
          }
        }
      ]
    })
  }
}

function resizeCharts() {
  pieChart?.resize()
  barChart?.resize()
}

/* ---------- 数据加载 ---------- */
async function loadStats() {
  loading.value = true
  try {
    const res = await getStats()
    stats.overview = res.data.overview || stats.overview
    stats.cities = res.data.cities || []
    stats.recent = res.data.recent || []
    await nextTick()
    renderCharts()
  } catch {
    // 拦截器统一提示
  } finally {
    loading.value = false
  }
}

function open(item) {
  router.push({ path: '/detail', query: { id: item.id } })
}

function formatMoney(n) {
  return Number(n || 0).toLocaleString('zh-CN')
}

function formatDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/* 深浅色切换时按新主题重绘 */
watch(
  () => app.dark,
  () => renderCharts()
)

window.addEventListener('resize', resizeCharts)
onUnmounted(() => {
  window.removeEventListener('resize', resizeCharts)
  pieChart?.dispose()
  barChart?.dispose()
})

onMounted(loadStats)
</script>

<style scoped>
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.stats-body {
  min-height: 300px;
}

/* 空状态 */
.empty-card {
  min-height: 420px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.empty-card h3 {
  margin: 16px 0 10px;
}

.empty-desc {
  color: var(--color-text-secondary);
  line-height: 1.8;
  font-size: 13px;
  margin: 0 0 20px;
}

/* 概览卡 */
.overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 14px;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}

.stat-label {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-top: 2px;
}

.stat-sub {
  font-size: 12px;
  color: var(--color-text-placeholder);
  margin-top: 2px;
}

/* 图表区 */
.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.chart-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 12px;
}

.chart-box {
  height: 300px;
}

/* 最近足迹 */
.recent-timeline {
  padding-left: 4px;
}

.recent-item {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 2px 0;
}

.recent-item:hover .recent-title {
  color: var(--color-primary);
}

.recent-title {
  font-size: 14px;
  font-weight: 600;
  transition: color 0.15s;
}

.recent-meta {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.recent-meta .el-icon {
  margin-left: 8px;
}

.recent-meta .amount {
  margin-left: 8px;
  font-size: 12px;
}
</style>
