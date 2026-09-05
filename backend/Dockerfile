# ============================================================
#  智能旅游助手 · 后端服务镜像
#
#  设计要点：
#   1. 多阶段构建 —— 依赖安装与运行分离，最终镜像不含 npm 缓存与 devDependencies
#   2. 非 root 运行 —— 容器被攻破时限制影响面
#   3. dumb-init  —— 正确转发 SIGTERM 并以 PID 1 回收僵尸进程，
#                    让 src/index.js 中的优雅停机逻辑真正生效
#   4. 健康检查   —— 供 docker-compose 做启动顺序编排
# ============================================================

# ---------------- 阶段一：安装依赖 ----------------
FROM node:20-alpine AS deps

WORKDIR /app

# 先只复制依赖清单，充分利用 Docker 层缓存：
# 只要 package.json / package-lock.json 未变，就不会重复 npm ci
COPY package.json package-lock.json ./

# --omit=dev 只装生产依赖（nodemon 等不会被打进镜像）
RUN npm ci --omit=dev && npm cache clean --force

# ---------------- 阶段二：运行 ----------------
FROM node:20-alpine AS runtime

# dumb-init：解决 Node 无法直接接收 SIGTERM 导致容器停止超时的问题
# tzdata：让 TZ=Asia/Shanghai 真正生效，避免日志与数据库时间差 8 小时
RUN apk add --no-cache dumb-init tzdata

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    TZ=Asia/Shanghai

# 从依赖阶段只取 node_modules，不带任何中间产物
COPY --from=deps /app/node_modules ./node_modules

COPY package.json ./
COPY src ./src
COPY sql ./sql

# 切换到 node 镜像内置的非 root 用户（uid 1000）
RUN chown -R node:node /app
USER node

EXPOSE 3000

# 健康检查：/api/health 会返回模型配置、数据库连通性与网关指标
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null 2>&1 || exit 1

# 用 dumb-init 作为 PID 1，转发信号给 Node 进程
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/index.js"]
