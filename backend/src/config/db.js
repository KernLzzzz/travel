/**
 * MySQL 连接池
 * 采用惰性初始化 + 优雅降级：数据库未配置或连接失败时不会导致整个服务崩溃，
 * AI 相关接口仍可正常使用，仅数据库功能不可用。
 */
import mysql from 'mysql2/promise'
import config from './index.js'

let pool = null
let available = false
let initPromise = null

/**
 * 初始化连接池（只会真正执行一次）
 * @returns {Promise<boolean>} 数据库是否可用
 */
async function initPool() {
  if (initPromise) return initPromise

  initPromise = (async () => {
    const { host, port, user, password, database } = config.db

    if (!database) {
      console.warn('[DB] 未配置 DB_NAME，跳过数据库连接，数据库相关功能不可用')
      return false
    }

    try {
      pool = mysql.createPool({
        host,
        port,
        user,
        password,
        database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
        charset: 'utf8mb4'
      })

      // 主动探活，确认配置正确
      const conn = await pool.getConnection()
      await conn.ping()
      conn.release()

      available = true
      console.log(`[DB] MySQL 连接成功 -> ${host}:${port}/${database}`)
      return true
    } catch (err) {
      available = false
      pool = null
      console.warn(`[DB] MySQL 连接失败，数据库功能不可用：${err.message}`)
      console.warn('[DB] 请检查 .env 中的 DB_* 配置，并确认已执行 sql/schema.sql 建库建表')
      return false
    }
  })()

  return initPromise
}

/** 数据库当前是否可用 */
export function isDbAvailable() {
  return available
}

/** 获取连接池，不可用时返回 null */
export async function getPool() {
  if (!available) await initPool()
  return available ? pool : null
}

/**
 * 执行查询
 * @param {string} sql SQL 语句（使用 ? 占位符）
 * @param {any[]} params 参数
 * @returns {Promise<any>} 查询结果
 */
export async function query(sql, params = []) {
  const p = await getPool()
  if (!p) throw new Error('数据库未连接，请检查 .env 中的 DB_* 配置并执行 sql/schema.sql')
  const [rows] = await p.execute(sql, params)
  return rows
}

/**
 * 执行事务
 * @param {(conn: import('mysql2/promise').PoolConnection) => Promise<any>} handler 事务回调
 */
export async function transaction(handler) {
  const p = await getPool()
  if (!p) throw new Error('数据库未连接，请检查 .env 中的 DB_* 配置并执行 sql/schema.sql')
  const conn = await p.getConnection()
  try {
    await conn.beginTransaction()
    const result = await handler(conn)
    await conn.commit()
    return result
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

export { initPool }
export default { query, transaction, isDbAvailable, initPool, getPool }
