# Spring Boot 后端迁移说明

`backend-java` 是对原 `backend` 的增量迁移实现，保留原有 Vue 前端约定：统一响应结构为 `{ code, message, data }`，鉴权头为 `Authorization: Bearer <token>`，行程规划仍使用 `start / chunk / done / error` 四类 SSE 事件。

## 已迁移模块

- **AI 网关**：令牌桶限流、`Semaphore` 并发保护、流式超时、LRU + TTL 缓存、运行时指标。
- **鉴权**：JWT 签发和校验、BCrypt 密码哈希、资料/偏好/密码接口。
- **行程 CRUD**：保存、分页筛选、详情、更新、删除、收藏和足迹统计；直接复用原 MySQL `users` 与 `itineraries` 表。
- **行程生成**：OpenAI 兼容 LLM 的 SSE 上游流接入；未配置 `LLM_API_KEY` 时自动 Mock，便于演示和联调。

## 本地启动

```bash
cd backend-java
mvn spring-boot:run
```

Docker Compose 会将根目录 `.env` 中的同名配置传入应用：`DB_*`、`JWT_SECRET`、`LLM_*`、`AI_*`。本地用 Maven 启动时，请在系统环境变量或 IDE Run Configuration 中设置这些变量；数据库表结构继续使用 `../backend/sql/schema.sql` 初始化。请保证 `JWT_SECRET` 至少 32 字节。

## 运行和验证

```bash
mvn -DskipTests package
java -jar target/travel-ai-backend-1.0.0.jar
curl http://localhost:3000/api/health
```

项目根目录的 `docker compose up -d --build` 已切换为构建此模块。原 `backend` 不会被删除，作为接口行为对照与回退版本保留。
