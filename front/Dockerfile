# ============================================================
#  智能旅游助手 · 前端镜像
#
#  设计要点：
#   1. 多阶段构建 —— Node 阶段产出静态文件，Nginx 阶段只保留 dist，
#      最终镜像不含 node_modules（体积从数百 MB 降到约 50MB）
#   2. Nginx 统一入口 —— 前端静态资源与 /api 反向代理共用 80 端口，
#      浏览器同源，彻底规避跨域问题
#   3. SSE 专项配置 —— 关闭代理缓冲，保证 AI 打字机效果不被 Nginx 攒包吞掉
# ============================================================

# ---------------- 阶段一：构建静态资源 ----------------
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---------------- 阶段二：Nginx 托管 ----------------
FROM nginx:1.27-alpine AS runtime

RUN apk add --no-cache tzdata

# 移除默认站点，挂载本项目配置
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 只拷贝构建产物，源码与 node_modules 全部留在构建阶段
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
