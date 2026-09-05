/**
 * 数据库初始化脚本
 * 读取 sql/schema.sql 并执行，用于快速建库建表
 *
 * 用法：npm run init-db
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import mysql from 'mysql2/promise'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const DB_NAME = process.env.DB_NAME || 'travel_ai'

async function main() {
  const schemaPath = path.resolve(__dirname, '../../sql/schema.sql')

  if (!fs.existsSync(schemaPath)) {
    console.error('未找到 sql/schema.sql')
    process.exit(1)
  }

  const sql = fs.readFileSync(schemaPath, 'utf8')

  console.log(`正在初始化数据库：${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}/${DB_NAME}`)

  // 建库语句需要不指定 database 的连接，否则库不存在时会连接失败
  let conn
  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      multipleStatements: true
    })

    await conn.query(sql)

    // 校验建表结果
    const [tables] = await conn.query(
      'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME',
      [DB_NAME]
    )

    console.log('\n建表成功，共 %d 张表：', tables.length)
    tables.forEach((t) => console.log('  -', t.TABLE_NAME))
    console.log('\n现在可以启动后端服务了：npm run dev')
  } catch (err) {
    console.error('\n初始化失败：', err.message)
    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('提示：数据库账号或密码不对，请检查 .env 中的 DB_USER / DB_PASSWORD')
    }
    if (err.code === 'ECONNREFUSED') {
      console.error('提示：连不上 MySQL，请确认服务已启动，且 .env 中的 DB_HOST / DB_PORT 正确')
    }
    process.exit(1)
  } finally {
    if (conn) await conn.end()
  }
}

main()
