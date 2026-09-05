/**
 * 行程 CRUD 控制器
 * 处理行程的保存、查询、收藏与删除
 */
import { query, isDbAvailable } from '../config/db.js'
import { ok, ApiError } from '../utils/response.js'

/** 数据库不可用时抛统一错误 */
function assertDb() {
  if (!isDbAvailable()) {
    throw new ApiError('数据库未连接，请检查 .env 中的 DB_* 配置并执行 sql/schema.sql', 503)
  }
}

/**
 * 安全解析 JSON 字段
 * mysql2 对 JSON 列的处理在不同版本下可能返回字符串或对象，这里统一成对象
 * @param {any} value
 * @returns {object|null}
 */
function safeParseJSON(value) {
  if (value == null) return null
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

/**
 * 保存行程
 * POST /api/itinerary
 * body: { city, budget, days, content, title? }
 */
export async function createItinerary(req, res) {
  assertDb()

  const { city, budget, days, content, title } = req.body || {}

  if (!city || !content) {
    throw new ApiError('城市和行程内容不能为空', 400)
  }

  const budgetNum = Number(budget) || 0
  const daysNum = Number(days) || 1
  const autoTitle = title || `${city}${daysNum}日游`

  const result = await query(
    'INSERT INTO itineraries (user_id, title, city, budget, days, content) VALUES (?, ?, ?, ?, ?, ?)',
    [req.userId, autoTitle, city, budgetNum, daysNum, JSON.stringify(content)]
  )

  ok(res, { id: result.insertId, title: autoTitle }, '行程保存成功', 201)
}

/**
 * 行程列表
 * GET /api/itinerary?page=1&pageSize=10&favorite=0&q=关键词&city=城市&sort=recent
 * sort: recent(默认) | budget_desc | budget_asc | days_desc | days_asc
 */
export async function listItineraries(req, res) {
  assertDb()

  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 10))
  const offset = (page - 1) * pageSize

  // 动态拼接查询条件，全部走参数化绑定，避免 SQL 注入
  const conditions = ['user_id = ?']
  const params = [req.userId]

  if (req.query.favorite === '1' || req.query.favorite === 'true') {
    conditions.push('is_favorite = 1')
  }

  const city = String(req.query.city || '').trim()
  if (city) {
    conditions.push('city = ?')
    params.push(city)
  }

  const keyword = String(req.query.q || '').trim()
  if (keyword) {
    // 关键词同时匹配标题与城市，LIKE 里的通配符由调用方自然输入即可
    conditions.push('(title LIKE ? OR city LIKE ?)')
    params.push(`%${keyword}%`, `%${keyword}%`)
  }

  // 排序字段来自白名单映射，不允许用户输入直接进 SQL
  const sortMap = {
    recent: 'created_at DESC',
    budget_desc: 'budget DESC',
    budget_asc: 'budget ASC',
    days_desc: 'days DESC',
    days_asc: 'days ASC'
  }
  const orderBy = sortMap[req.query.sort] || 'created_at DESC'

  const where = `WHERE ${conditions.join(' AND ')}`

  const rows = await query(
    `SELECT id, title, city, budget, days, is_favorite, created_at,
       JSON_UNQUOTE(JSON_EXTRACT(content, '$.summary')) AS summary
     FROM itineraries ${where}
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  )

  const totalRows = await query(`SELECT COUNT(*) AS total FROM itineraries ${where}`, params)

  // 顺带返回该用户去过的全部城市，供筛选下拉使用（不分页、不受筛选影响）
  // 注意：DISTINCT 下 ORDER BY 的列必须在 SELECT 列表中，故用 GROUP BY + MAX(created_at)
  const cityRows = await query(
    `SELECT city FROM itineraries
     WHERE user_id = ? AND city IS NOT NULL AND city != ''
     GROUP BY city ORDER BY MAX(created_at) DESC`,
    [req.userId]
  )

  ok(res, {
    list: rows,
    cities: cityRows.map((r) => r.city).filter(Boolean),
    pagination: {
      page,
      pageSize,
      total: totalRows[0]?.total || 0,
      totalPages: Math.ceil((totalRows[0]?.total || 0) / pageSize)
    }
  })
}

/**
 * 行程详情
 * GET /api/itinerary/:id
 */
export async function getItinerary(req, res) {
  assertDb()

  const { id } = req.params
  const rows = await query('SELECT * FROM itineraries WHERE id = ? AND user_id = ? LIMIT 1', [id, req.userId])

  if (rows.length === 0) {
    throw new ApiError('行程不存在或无权访问', 404)
  }

  const item = rows[0]
  ok(res, {
    ...item,
    content: safeParseJSON(item.content)
  })
}

/**
 * 更新行程（内容、标题或预算）
 * PUT /api/itinerary/:id
 * body: { content?, title?, budget? } 三个字段均可选，只更新传入的部分
 * budget 用于「换一个景点」保存时同步门票差额后的总预算
 */
export async function updateItinerary(req, res) {
  assertDb()

  const { id } = req.params
  const { content, title, budget } = req.body || {}

  if (content === undefined && title === undefined && budget === undefined) {
    throw new ApiError('没有需要更新的内容', 400)
  }
  if (content !== undefined && (typeof content !== 'object' || content === null)) {
    throw new ApiError('行程内容格式不正确', 400)
  }
  if (title !== undefined && (typeof title !== 'string' || !title.trim())) {
    throw new ApiError('标题不能为空', 400)
  }
  if (budget !== undefined && (!Number.isFinite(Number(budget)) || Number(budget) < 0)) {
    throw new ApiError('预算格式不正确', 400)
  }

  const fields = []
  const params = []
  if (content !== undefined) {
    fields.push('content = ?')
    params.push(JSON.stringify(content))
  }
  if (title !== undefined) {
    fields.push('title = ?')
    params.push(title.trim())
  }
  if (budget !== undefined) {
    fields.push('budget = ?')
    params.push(Number(budget))
  }
  params.push(id, req.userId)

  const result = await query(
    `UPDATE itineraries SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
    params
  )

  if (result.affectedRows === 0) {
    throw new ApiError('行程不存在或无权操作', 404)
  }

  ok(res, null, '行程已更新')
}

/**
 * 删除行程
 * DELETE /api/itinerary/:id
 */
export async function deleteItinerary(req, res) {
  assertDb()

  const { id } = req.params
  const result = await query('DELETE FROM itineraries WHERE id = ? AND user_id = ?', [id, req.userId])

  if (result.affectedRows === 0) {
    throw new ApiError('行程不存在或无权删除', 404)
  }

  ok(res, null, '行程已删除')
}

/**
 * 切换收藏状态
 * POST /api/itinerary/:id/favorite
 */
export async function toggleFavorite(req, res) {
  assertDb()

  const { id } = req.params

  const rows = await query('SELECT id, is_favorite FROM itineraries WHERE id = ? AND user_id = ? LIMIT 1', [
    id,
    req.userId
  ])

  if (rows.length === 0) {
    throw new ApiError('行程不存在或无权操作', 404)
  }

  const next = rows[0].is_favorite ? 0 : 1
  await query('UPDATE itineraries SET is_favorite = ? WHERE id = ?', [next, id])

  ok(res, { isFavorite: Boolean(next) }, next ? '已收藏' : '已取消收藏')
}

/**
 * 旅行足迹统计
 * GET /api/itinerary/stats
 * 概览指标 + 城市分布 + 最近足迹，一次请求全部返回，供足迹页直接渲染
 */
export async function getStats(req, res) {
  assertDb()

  // 概览：行程总数、累计天数、累计预算、收藏数
  // SUM 在无任何记录时返回 NULL，用 COALESCE 归零，避免前端出现 null
  const overviewRows = await query(
    `SELECT
       COUNT(*) AS tripCount,
       COALESCE(SUM(days), 0) AS totalDays,
       COALESCE(SUM(budget), 0) AS totalBudget,
       COALESCE(SUM(is_favorite), 0) AS favoriteCount
     FROM itineraries
     WHERE user_id = ?`,
    [req.userId]
  )

  // 城市分布：按城市聚合出行程数 / 累计天数 / 累计预算，供图表使用
  const cityRows = await query(
    `SELECT city,
            COUNT(*) AS tripCount,
            COALESCE(SUM(days), 0) AS totalDays,
            COALESCE(SUM(budget), 0) AS totalBudget
     FROM itineraries
     WHERE user_id = ? AND city IS NOT NULL AND city != ''
     GROUP BY city
     ORDER BY tripCount DESC, totalBudget DESC
     LIMIT 12`,
    [req.userId]
  )

  // 最近足迹：最近 6 条行程概要，供时间线展示
  const recentRows = await query(
    `SELECT id, title, city, days, budget, created_at
     FROM itineraries
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 6`,
    [req.userId]
  )

  ok(res, {
    overview: overviewRows[0] || { tripCount: 0, totalDays: 0, totalBudget: 0, favoriteCount: 0 },
    cities: cityRows,
    recent: recentRows
  })
}

export default {
  createItinerary,
  listItineraries,
  getItinerary,
  updateItinerary,
  deleteItinerary,
  toggleFavorite,
  getStats
}
