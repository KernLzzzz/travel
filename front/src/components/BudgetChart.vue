<template>
  <div ref="chartRef" class="budget-chart"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  /** 预算明细：{ accommodation, food, transportation, tickets, other } */
  breakdown: {
    type: Object,
    required: true
  },
  /** 总预算 */
  total: {
    type: Number,
    default: 0
  }
})

const chartRef = ref(null)
let chart = null

const LABELS = {
  accommodation: '住宿',
  food: '餐饮',
  transportation: '交通',
  tickets: '门票',
  other: '其他'
}

const COLORS = ['#f56c0a', '#15803d', '#8b5cf6', '#f59e0b', '#a8a29e']

function isDark() {
  return document.documentElement.classList.contains('dark')
}

function render() {
  if (!chart) return

  const data = Object.entries(LABELS).map(([key, label]) => ({
    name: label,
    value: props.breakdown?.[key] || 0
  }))

  const textColor = isDark() ? '#f9fafb' : '#1f2937'
  const subColor = isDark() ? '#9ca3af' : '#6b7280'

  chart.setOption({
    color: COLORS,
    tooltip: {
      trigger: 'item',
      formatter: (p) => `${p.name}<br/>¥${p.value}（${p.percent}%）`
    },
    legend: {
      bottom: 0,
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: subColor, fontSize: 12 }
    },
    series: [
      {
        type: 'pie',
        radius: ['58%', '80%'],
        center: ['50%', '42%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 6, borderWidth: 2, borderColor: isDark() ? '#1f2937' : '#fff' },
        label: {
          show: true,
          position: 'center',
          formatter: () => `总预算\n¥${props.total}`,
          color: textColor,
          fontSize: 16,
          fontWeight: 600,
          lineHeight: 22
        },
        emphasis: {
          scale: true,
          scaleSize: 6,
          label: { show: false }
        },
        data
      }
    ]
  })
}

function onResize() {
  chart?.resize()
}

onMounted(() => {
  chart = echarts.init(chartRef.value)
  render()
  window.addEventListener('resize', onResize)
})

watch(() => [props.breakdown, props.total], render, { deep: true })

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  chart?.dispose()
  chart = null
})
</script>

<style scoped>
.budget-chart {
  width: 100%;
  height: 280px;
}
</style>
