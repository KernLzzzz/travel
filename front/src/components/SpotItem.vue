<template>
  <div class="spot-item" :class="{ replaced }">
    <span class="period-tag" :class="[{ solid: replaced || swapping }, period]">{{ periodLabel }}</span>

    <!-- 推荐中：骨架占位 -->
    <div v-if="swapping" class="spot-body swapping-body">
      <div class="spot-name-row">
        <el-skeleton-item variant="text" style="width: 120px; height: 16px" />
        <button class="swap-btn" disabled type="button">
          <el-icon class="swap-icon" :size="13"><RefreshRight /></el-icon>
          推荐中
        </button>
      </div>
      <div class="swap-hint">
        <el-icon class="hint-icon" :size="13"><Loading /></el-icon>
        AI 正在推荐替代景点…
      </div>
      <el-skeleton-item variant="text" style="width: 88%" class="desc-skeleton" />
      <el-skeleton-item variant="text" style="width: 62%" />
    </div>

    <!-- 正常 / 已替换 -->
    <div v-else class="spot-body">
      <div class="spot-name-row">
        <div class="name-with-badge">
          <div class="spot-name" :class="{ placeholder: !data?.spot }">
            {{ data?.spot || '生成中…' }}
          </div>
          <span v-if="replaced" class="replaced-badge">已替换</span>
        </div>

        <span v-if="replaced" class="action-group">
          <button class="undo-btn" type="button" @click="$emit('undo')">
            <el-icon :size="12"><RefreshLeft /></el-icon>
            撤销
          </button>
        </span>
        <el-tooltip
          v-else-if="swappable && data?.spot"
          content="让 AI 换一个不同类型的去处"
          placement="top"
        >
          <button
            class="swap-btn"
            :disabled="swapping"
            type="button"
            @click="$emit('swap')"
          >
            <el-icon class="swap-icon" :size="13"><RefreshRight /></el-icon>
            换一个
          </button>
        </el-tooltip>
      </div>

      <!-- 原计划提示（已替换态） -->
      <div v-if="replaced" class="original-line">
        原计划：{{ originalSpot }}<template v-if="originalTicket">（{{ originalTicket }}）</template>
      </div>

      <div class="spot-meta" v-if="hasMeta">
        <span v-if="data?.duration" class="meta-item">
          <el-icon :size="13"><Clock /></el-icon>{{ data.duration }}
        </span>
        <span v-if="data?.ticket" class="meta-item">
          <el-icon :size="13"><Ticket /></el-icon>{{ data.ticket }}
        </span>
        <span v-if="data?.transportation" class="meta-item">
          <el-icon :size="13"><Van /></el-icon>{{ data.transportation }}
        </span>
      </div>
      <div class="spot-desc" v-if="data?.description">{{ data.description }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Clock, Ticket, Van, RefreshRight, RefreshLeft, Loading } from '@element-plus/icons-vue'

const props = defineProps({
  data: { type: Object, default: () => null },
  period: { type: String, default: 'morning' },
  swappable: { type: Boolean, default: false },
  swapping: { type: Boolean, default: false },
  replaced: { type: Boolean, default: false },
  originalSpot: { type: String, default: '' },
  originalTicket: { type: String, default: '' }
})

defineEmits(['swap', 'undo'])

const periodMap = {
  morning: '上午',
  afternoon: '下午',
  evening: '晚上'
}

const periodLabel = computed(() => periodMap[props.period] || '时段')
const hasMeta = computed(() => props.data?.duration || props.data?.ticket || props.data?.transportation)
</script>

<style scoped>
.spot-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  margin: 0 -12px;
  border-radius: 12px;
  transition: background 0.2s;
}

.spot-item + .spot-item {
  border-top: 1px dashed var(--color-border);
}

.spot-item.replaced {
  background: var(--color-primary-light);
}

.spot-item.replaced + .spot-item,
.spot-item + .spot-item.replaced {
  border-top: none;
}

/* 时段标签：杂志风强调色 */
.period-tag {
  flex-shrink: 0;
  height: fit-content;
  font-size: 12px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 8px;
  margin-top: 2px;
}

.period-tag.morning {
  background: #fff4eb;
  color: #f56c0a;
}

.period-tag.afternoon {
  background: #ecfdf5;
  color: #15803d;
}

.period-tag.evening {
  background: #f3f0ff;
  color: #8b5cf6;
}

.period-tag.solid {
  background: var(--color-primary);
  color: #fff;
}

.spot-body {
  flex: 1;
  min-width: 0;
}

.swapping-body {
  opacity: 0.75;
}

.spot-name-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.name-with-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.spot-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 4px;
}

.spot-name.placeholder {
  color: var(--color-text-placeholder);
  font-weight: 400;
}

.replaced-badge {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  color: var(--color-primary);
  background: rgba(245, 108, 10, 0.12);
  padding: 2px 8px;
  border-radius: 999px;
  margin-bottom: 4px;
}

.original-line {
  font-size: 12px;
  color: var(--color-text-placeholder);
  text-decoration: line-through;
  text-decoration-color: rgba(168, 162, 158, 0.7);
  margin-bottom: 6px;
}

.action-group {
  flex-shrink: 0;
  display: inline-flex;
}

.undo-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 24px;
  padding: 0 10px;
  font-size: 12px;
  color: var(--color-primary);
  background: transparent;
  border: 1px solid rgba(245, 108, 10, 0.45);
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.undo-btn:hover {
  background: rgba(245, 108, 10, 0.08);
  border-color: var(--color-primary);
}

.swap-hint {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--color-primary);
  margin: 6px 0 10px;
}

.hint-icon {
  animation: hint-spin 1s linear infinite;
}

.desc-skeleton {
  margin-bottom: 8px;
}

.swap-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 24px;
  padding: 0 10px;
  font-size: 12px;
  color: var(--color-text-secondary);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.swap-btn:hover:not(:disabled) {
  color: var(--color-primary);
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}

.swap-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.swap-btn.swapping .swap-icon {
  animation: swap-spin 0.8s linear infinite;
}

@keyframes swap-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes hint-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.spot-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-bottom: 4px;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.spot-desc {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.6;
}
</style>
