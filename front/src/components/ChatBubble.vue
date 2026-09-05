<template>
  <div class="bubble-row" :class="message.role">
    <!-- AI 头像 -->
    <el-avatar v-if="message.role === 'assistant'" :size="34" class="avatar ai">
      <el-icon><Guide /></el-icon>
    </el-avatar>

    <div class="bubble" :class="{ streaming: message.streaming }">
      <!-- 文本内容 -->
      <div v-if="message.role === 'user'" class="text">{{ message.content }}</div>
      <div v-else class="text markdown" v-html="renderedHtml"></div>

      <!-- 流式光标 -->
      <span v-if="message.streaming" class="cursor">▌</span>

      <!-- 内嵌行程卡片 -->
      <div
        v-if="message.type === 'itinerary' && message.itinerary"
        class="itin-card"
        @click="viewItinerary"
      >
        <div class="itin-head">
          <el-icon><MapLocation /></el-icon>
          <span>{{ message.itinerary.city }}{{ message.itinerary.days }}日游</span>
          <span class="itin-budget">¥{{ message.itinerary.totalBudget }}</span>
        </div>
        <div class="itin-preview">
          <div v-for="day in message.itinerary.dailyItinerary?.slice(0, 3)" :key="day.day" class="itin-day">
            <span class="day-no">D{{ day.day }}</span>
            <span class="day-route">{{ routeOf(day) }}</span>
          </div>
          <div v-if="message.itinerary.dailyItinerary?.length > 3" class="itin-more">
            …共 {{ message.itinerary.dailyItinerary.length }} 天
          </div>
        </div>
        <div class="itin-cta">
          点击查看完整行程
          <el-icon><ArrowRight /></el-icon>
        </div>
      </div>

      <div v-if="message.timestamp && !message.streaming" class="time">{{ formatTime }}</div>
    </div>

    <!-- 用户头像 -->
    <el-avatar v-if="message.role === 'user'" :size="34" class="avatar user">{{ userInitial }}</el-avatar>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { usePlanStore } from '@/stores/plan'
import { useUserStore } from '@/stores/user'

marked.setOptions({ breaks: true, gfm: true })

const props = defineProps({
  message: {
    type: Object,
    required: true
  }
})

const router = useRouter()
const planStore = usePlanStore()
const userStore = useUserStore()

const renderedHtml = computed(() => {
  if (props.message.role !== 'assistant' || !props.message.content) return ''
  try {
    return DOMPurify.sanitize(marked.parse(props.message.content))
  } catch {
    return props.message.content
  }
})

const userInitial = computed(() => (userStore.nickname || '游').slice(0, 1))

const formatTime = computed(() => {
  const d = new Date(props.message.timestamp)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
})

function routeOf(day) {
  const spots = [day.morning?.spot, day.afternoon?.spot, day.evening?.spot].filter(Boolean)
  return spots.join(' → ') || day.theme || ''
}

function viewItinerary() {
  planStore.setItinerary(props.message.itinerary)
  router.push('/detail')
}
</script>

<style scoped>
.bubble-row {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  align-items: flex-start;
}

.bubble-row.user {
  flex-direction: row-reverse;
}

.avatar {
  flex-shrink: 0;
}

.avatar.ai {
  background: linear-gradient(135deg, #8b5cf6, #7c3aed);
  color: #fff;
}

.avatar.user {
  background: linear-gradient(135deg, #f56c0a, #f59e0b);
  color: #fff;
  font-weight: 600;
}

.bubble {
  max-width: 70%;
  padding: 12px 16px;
  border-radius: 18px;
  font-size: 14px;
  line-height: 1.7;
  word-break: break-word;
  position: relative;
}

.bubble-row.user .bubble {
  background: linear-gradient(135deg, #f56c0a, #f59e0b);
  color: #fff;
  border-bottom-right-radius: 6px;
}

.bubble-row.assistant .bubble {
  background: var(--color-bg);
  border: 1px solid var(--color-border-light);
  border-bottom-left-radius: 6px;
}

.time {
  font-size: 11px;
  margin-top: 6px;
  opacity: 0.65;
  text-align: right;
}

.cursor {
  color: var(--color-primary);
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* Markdown 样式 */
.markdown :deep(p) {
  margin: 0 0 8px;
}

.markdown :deep(p:last-child) {
  margin-bottom: 0;
}

.markdown :deep(ul),
.markdown :deep(ol) {
  margin: 4px 0;
  padding-left: 20px;
}

.markdown :deep(code) {
  background: var(--color-hover);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
}

.markdown :deep(pre) {
  background: var(--color-hover);
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
}

.markdown :deep(strong) {
  color: var(--color-text);
}

/* 内嵌行程卡片 */
.itin-card {
  margin-top: 12px;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  overflow: hidden;
  cursor: pointer;
  transition: box-shadow 0.2s, transform 0.2s;
  background: #fff;
}

.itin-card:hover {
  box-shadow: var(--shadow-hover);
  transform: translateY(-1px);
}

.itin-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--color-primary-light);
  color: var(--color-primary);
  font-weight: 700;
}

.itin-budget {
  margin-left: auto;
  font-size: 13px;
}

.itin-preview {
  padding: 10px 14px;
}

.itin-day {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: var(--color-text-secondary);
  padding: 3px 0;
}

.day-no {
  flex-shrink: 0;
  color: var(--color-primary);
  font-weight: 700;
}

.itin-more {
  font-size: 12px;
  color: var(--color-text-placeholder);
  padding-top: 3px;
}

.itin-cta {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 14px;
  border-top: 1px dashed var(--color-border);
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 600;
}
</style>
