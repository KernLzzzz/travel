<template>
  <div class="my-page">
    <div class="page-head">
      <div>
        <h2 class="page-title">我的行程</h2>
        <p class="page-subtitle">你保存过的所有旅行规划 · 共 {{ pagination.total }} 个</p>
      </div>
      <el-button type="primary" class="new-btn" @click="router.push('/')">
        <el-icon style="margin-right: 6px"><Plus /></el-icon>
        新建行程
      </el-button>
    </div>

    <!-- 检索工具栏 -->
    <div class="toolbar">
      <el-input
        v-model="filters.q"
        class="search-input"
        placeholder="搜索目的地、行程名称"
        clearable
        @keyup.enter="loadList(1)"
        @clear="loadList(1)"
      >
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>

      <el-select
        v-model="filters.city"
        placeholder="全部城市"
        clearable
        filterable
        style="width: 150px"
        @change="loadList(1)"
      >
        <el-option v-for="c in cityOptions" :key="c" :label="c" :value="c" />
      </el-select>

      <el-select v-model="filters.sort" style="width: 160px" @change="loadList(1)">
        <el-option label="最近创建" value="recent" />
        <el-option label="预算从高到低" value="budget_desc" />
        <el-option label="预算从低到高" value="budget_asc" />
        <el-option label="天数最多" value="days_desc" />
        <el-option label="天数最少" value="days_asc" />
      </el-select>
    </div>

    <el-tabs v-model="activeTab" class="my-tabs" @tab-change="loadList(1)">
      <el-tab-pane label="全部行程" name="all" />
      <el-tab-pane label="我的收藏" name="favorite" />
    </el-tabs>

    <div v-loading="loading" class="list-area">
      <!-- 行程卡片网格 -->
      <div v-if="list.length" class="card-grid">
        <div
          v-for="item in list"
          :key="item.id"
          class="itin-card hoverable"
          @click="open(item)"
        >
          <!-- 顶部渐变封面 -->
          <div class="itin-cover" :style="coverStyle(item.city)">
            <div class="cover-main">
              <div class="cover-city">{{ item.city }}</div>
              <div class="cover-meta">{{ item.days }} 天 · {{ item.is_favorite ? '已收藏' : '已完成' }}</div>
            </div>
            <el-icon
              class="fav-icon"
              :class="{ active: item.is_favorite }"
              @click.stop="toggleFav(item)"
            >
              <StarFilled v-if="item.is_favorite" /><Star v-else />
            </el-icon>
          </div>

          <div class="itin-body">
            <div class="itin-title">{{ item.title }}</div>
            <div class="itin-subtitle">
              <span class="days-badge">{{ item.days }} 天</span>
              <span class="amount">¥{{ item.budget }}</span>
            </div>
            <div class="itin-time">{{ formatDate(item.created_at) }} 生成</div>
          </div>

          <div class="itin-actions">
            <el-icon class="del-icon" @click.stop="remove(item)"><Delete /></el-icon>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else-if="!loading" class="card empty-card">
        <el-empty :description="emptyText">
          <el-button type="primary" @click="router.push('/')">去规划一份行程</el-button>
        </el-empty>
      </div>

      <!-- 分页 -->
      <el-pagination
        v-if="pagination.total > pagination.pageSize"
        class="pagination"
        layout="prev, pager, next"
        :total="pagination.total"
        :page-size="pagination.pageSize"
        :current-page="pagination.page"
        @current-change="loadList"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { listItineraries, deleteItinerary, toggleFavorite } from '@/api/itinerary'

const router = useRouter()

const activeTab = ref('all')
const loading = ref(false)
const list = ref([])
const pagination = reactive({ page: 1, pageSize: 12, total: 0, totalPages: 0 })

const filters = reactive({ q: '', city: '', sort: 'recent' })
const cityOptions = ref([])

const emptyText = computed(() => {
  if (activeTab.value === 'favorite') return '还没有收藏任何行程'
  if (filters.q || filters.city) return '没有符合条件的结果，换个关键词试试'
  return '还没有保存过行程'
})

const CITY_GRADIENTS = {
  成都: 'linear-gradient(135deg, #f56c0a 0%, #dc2626 100%)',
  重庆: 'linear-gradient(135deg, #dc2626 0%, #f59e0b 100%)',
  西安: 'linear-gradient(135deg, #7c3aed 0%, #db2777 100%)',
  杭州: 'linear-gradient(135deg, #15803d 0%, #0d9488 100%)',
  三亚: 'linear-gradient(135deg, #0d9488 0%, #0284c7 100%)',
  北京: 'linear-gradient(135deg, #b91c1c 0%, #7c2d12 100%)',
  上海: 'linear-gradient(135deg, #0284c7 0%, #4f46e5 100%)',
  广州: 'linear-gradient(135deg, #ca8a04 0%, #f97316 100%)',
  深圳: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
  南京: 'linear-gradient(135deg, #059669 0%, #15803d 100%)',
  武汉: 'linear-gradient(135deg, #db2777 0%, #be185d 100%)',
  厦门: 'linear-gradient(135deg, #0891b2 0%, #0d9488 100%)',
  青岛: 'linear-gradient(135deg, #2563eb 0%, #0284c7 100%)',
  长沙: 'linear-gradient(135deg, #ea580c 0%, #dc2626 100%)',
  昆明: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
  大理: 'linear-gradient(135deg, #9333ea 0%, #7c3aed 100%)',
  丽江: 'linear-gradient(135deg, #d97706 0%, #f97316 100%)',
  桂林: 'linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)',
  苏州: 'linear-gradient(135deg, #4f46e5 0%, #0891b2 100%)',
  拉萨: 'linear-gradient(135deg, #c2410c 0%, #9a3412 100%)'
}

const FALLBACK = [
  'linear-gradient(135deg, #f56c0a 0%, #f59e0b 100%)',
  'linear-gradient(135deg, #15803d 0%, #0d9488 100%)',
  'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
  'linear-gradient(135deg, #dc2626 0%, #f43f5e 100%)',
  'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
  'linear-gradient(135deg, #db2777 0%, #be185d 100%)'
]

function cityGradient(city) {
  if (CITY_GRADIENTS[city]) return CITY_GRADIENTS[city]
  let hash = 0
  for (let i = 0; i < (city || '').length; i++) hash = (hash * 31 + city.charCodeAt(i)) >>> 0
  return FALLBACK[hash % FALLBACK.length]
}

function coverStyle(city) {
  return { background: cityGradient(city) }
}

async function loadList(page = 1) {
  loading.value = true
  try {
    const res = await listItineraries({
      page,
      pageSize: pagination.pageSize,
      favorite: activeTab.value === 'favorite' ? 1 : 0,
      q: filters.q.trim() || undefined,
      city: filters.city || undefined,
      sort: filters.sort
    })
    list.value = res.data.list
    cityOptions.value = res.data.cities || []
    Object.assign(pagination, res.data.pagination)
  } catch {
    // 拦截器统一提示
  } finally {
    loading.value = false
  }
}

function open(item) {
  router.push({ path: '/detail', query: { id: item.id } })
}

async function toggleFav(item) {
  try {
    const res = await toggleFavorite(item.id)
    item.is_favorite = res.data.isFavorite ? 1 : 0
    if (activeTab.value === 'favorite' && !res.data.isFavorite) {
      list.value = list.value.filter((i) => i.id !== item.id)
      pagination.total = Math.max(0, pagination.total - 1)
    }
    ElMessage.success(res.message)
  } catch {
    // 拦截器统一提示
  }
}

async function remove(item) {
  try {
    await ElMessageBox.confirm(`确定删除「${item.title}」吗？删除后不可恢复。`, '删除行程', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
    await deleteItinerary(item.id)
    ElMessage.success('行程已删除')
    loadList(pagination.page)
  } catch {
    // 用户取消
  }
}

function formatDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

onMounted(() => loadList(1))
</script>

<style scoped>
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.new-btn {
  border-radius: 12px;
}

.toolbar {
  display: flex;
  gap: 10px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.search-input {
  flex: 1;
  min-width: 220px;
  max-width: 320px;
}

:deep(.search-input .el-input__wrapper),
:deep(.toolbar .el-select .el-input__wrapper) {
  border-radius: 12px;
}

.my-tabs :deep(.el-tabs__item) {
  font-weight: 600;
}

.my-tabs :deep(.el-tabs__active-bar) {
  background: var(--color-primary);
}

.my-tabs :deep(.el-tabs__item.is-active) {
  color: var(--color-primary);
}

.list-area {
  min-height: 300px;
  margin-top: 10px;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.itin-card {
  cursor: pointer;
  background: var(--color-card);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: transform 0.2s, box-shadow 0.2s;
}

.itin-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-hover);
}

.itin-cover {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  height: 120px;
  padding: 18px;
  color: #fff;
}

.cover-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cover-city {
  font-size: 32px;
  font-weight: 800;
  line-height: 1;
}

.cover-meta {
  font-size: 12px;
  opacity: 0.92;
  font-weight: 600;
}

.fav-icon {
  font-size: 20px;
  color: rgba(255, 255, 255, 0.8);
  transition: color 0.15s, transform 0.15s;
}

.fav-icon:hover {
  transform: scale(1.15);
}

.fav-icon.active {
  color: #fbbf24;
}

.itin-body {
  flex: 1;
  padding: 16px;
}

.itin-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 10px;
  line-height: 1.4;
}

.itin-subtitle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.days-badge {
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.amount {
  font-size: 18px;
  font-weight: 800;
  color: var(--color-primary);
}

.itin-time {
  font-size: 12px;
  color: var(--color-text-placeholder);
}

.itin-actions {
  display: flex;
  justify-content: flex-end;
  padding: 0 16px 14px;
}

.del-icon {
  font-size: 16px;
  color: var(--color-text-placeholder);
  transition: color 0.15s;
}

.del-icon:hover {
  color: var(--color-danger);
}

.empty-card {
  padding: 40px;
}

.pagination {
  margin-top: 24px;
  justify-content: center;
}
</style>
