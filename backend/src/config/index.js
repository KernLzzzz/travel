/**
 * 全局配置中心
 * 统一读取环境变量，避免各处散落 process.env
 */
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

/** 内置模型提供商预设 */
export const LLM_PROVIDERS = {
  siliconflow: {
    name: '硅基流动',
    baseURL: 'https://api.siliconflow.cn/v1',
    defaultModel: 'Qwen/Qwen2.5-72B-Instruct'
  },
  deepseek: {
    name: 'DeepSeek',
    baseURL: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat'
  }
}

const providerKey = (process.env.LLM_PROVIDER || 'siliconflow').toLowerCase()
const provider = LLM_PROVIDERS[providerKey] || LLM_PROVIDERS.siliconflow

export const config = {
  server: {
    port: Number(process.env.PORT) || 3000,
    env: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173'
  },
  llm: {
    provider: providerKey,
    providerName: provider.name,
    apiKey: process.env.LLM_API_KEY || '',
    model: process.env.LLM_MODEL || provider.defaultModel,
    baseURL: process.env.LLM_BASE_URL || provider.baseURL,
    temperature: Number(process.env.LLM_TEMPERATURE || 0.7),
    maxTokens: Number(process.env.LLM_MAX_TOKENS || 4096),
    /** 未配置 API Key 时启用 Mock 模式，保证无 Key 也能完整演示 */
    mock: !process.env.LLM_API_KEY
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'travel_ai_dev_secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'travel_ai'
  }
}

export default config
