# AIMarket 生产部署清单

面向首次上线或版本升级。假设使用 Linux 主机 + Node 20+ + pnpm。

容器化与 CI/CD 详见 [DEPLOY_CI.md](./DEPLOY_CI.md)（国内机 `3100`/`4100`，独立 `/opt/aimarket`）。

## 1. 架构概览

| 组件 | 默认端口 | 说明 |
|------|----------|------|
| `apps/web` | 3000 | Next.js 前端 |
| `apps/api` | 4000 | Hono API + SQLite + 本地 uploads |
| Redis（可选） | 6379 | `JOB_QUEUE=redis`、分布式限流 |

推荐：**Nginx/Caddy** 反代 HTTPS，API 与 Web 分域名或同域 `/api` 转发。

## 2. 环境变量（生产）

复制 `.env.example` 为 `.env`，至少配置：

```bash
# 前端（构建时注入）
NEXT_PUBLIC_API_URL=https://api.yourdomain.com

# API
PORT=4000
CORS_ORIGIN=https://www.yourdomain.com
JWT_SECRET=<随机 32+ 字符>
ADMIN_SECRET=<随机管理密钥>
DATABASE_PATH=/var/aimarket/data/aimarket.db
UPLOAD_DIR=/var/aimarket/uploads
PUBLIC_WEB_URL=https://www.yourdomain.com

# 图像（生产建议 openai）
IMAGE_PROVIDER=openai
OPENAI_API_KEY=sk-...

# 内容审核（Phase 6A）
MODERATION_PROVIDER=openai
# 或第三方 HTTP：MODERATION_PROVIDER=http + MODERATION_HTTP_URL=...
OPENAI_MODERATION_MODEL=omni-moderation-latest
MODERATION_OUTPUT=true

# 任务队列（推荐 redis）
JOB_QUEUE=redis
REDIS_URL=redis://127.0.0.1:6379
JOB_CONCURRENCY=2
RATE_LIMIT_STORE=redis

# 支付
PAYMENT_PROVIDER=stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

完整说明见 [STAGING.md](./STAGING.md)、[PHASE6.md](./PHASE6.md)。

## 3. 构建与启动

```bash
pnpm install
pnpm -r build

# API（需持久化 data/ 与 uploads/）
cd apps/api && node dist/index.js

# Web
cd apps/web && pnpm start
```

开发环境：`pnpm dev`（Web 3000 + API 4000）。

## 4. 部署前检查

- [ ] `JWT_SECRET`、`ADMIN_SECRET` 已更换默认值
- [ ] `CORS_ORIGIN` 与前端域名完全一致（含 `https`）
- [ ] `DATABASE_PATH`、`UPLOAD_DIR` 目录可写且已备份策略
- [ ] API 代码或 env 变更后**已重启**
- [ ] Redis 可用（若启用 `JOB_QUEUE=redis` / `RATE_LIMIT_STORE=redis`）
- [ ] Stripe Webhook 指向 `https://api.../api/v1/product/webhook/stripe`
- [ ] `MODERATION_PROVIDER` 非纯 `local`（生产建议 `openai` 或 `http`）

## 5. 冒烟与回归

```bash
# 在可访问 API 的机器上
API_URL=https://api.yourdomain.com \
ADMIN_SECRET=xxx \
node scripts/smoke-api.mjs
```

浏览器清单：[SMOKE_TEST.md](./SMOKE_TEST.md)。

## 6. Nginx 示例（片段）

```nginx
server {
  listen 443 ssl;
  server_name www.yourdomain.com;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
  }
}

server {
  listen 443 ssl;
  server_name api.yourdomain.com;
  client_max_body_size 32m;
  location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
  location /uploads/ {
    alias /var/aimarket/uploads/;
  }
}
```

## 7. 进程守护（systemd 示例）

`/etc/systemd/system/aimarket-api.service`：

```ini
[Unit]
Description=AIMarket API
After=network.target redis.service

[Service]
Type=simple
User=aimarket
WorkingDirectory=/opt/aimarket/apps/api
EnvironmentFile=/opt/aimarket/.env
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

## 8. 升级流程

1. `git pull` 目标版本
2. `pnpm install && pnpm -r build`
3. 备份 SQLite 与 `uploads/`
4. 重启 API → 再重启 Web
5. 运行 `scripts/smoke-api.mjs`
6. Admin 检查举报队列与埋点统计

## 9. 监控建议

- `/health` 返回 `version`（当前 0.8.0）
- Admin `GET /api/v1/admin/stats`：Provider、审核、限流、队列状态
- Admin `GET /api/v1/admin/analytics?days=7`：埋点汇总
- 日志：生成失败、审核 API 降级、Redis 连接失败

## 10. PostgreSQL（可选）

默认使用 SQLite（`DATABASE_PATH`）。多实例 / 高并发可改用 PostgreSQL：

```bash
export DATABASE_URL=postgresql://user:pass@host:5432/aimarket
cd apps/api && pnpm exec tsx src/db/postgres-bootstrap.ts
```

完整 schema 见 `apps/api/src/db/migrations/postgres.sql`。  
将 API 主库切换为 Postgres 需在后续版本接通 `DATABASE_URL`（当前运行仍以 SQLite 为准）。

## 11. 对象存储 / CDN

```bash
STORAGE_PROVIDER=s3
S3_BUCKET=your-bucket
S3_REGION=ap-guangzhou
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
# 腾讯云 COS / MinIO 等兼容 S3：
S3_ENDPOINT=https://cos.ap-guangzhou.myqcloud.com
S3_PUBLIC_URL=https://cdn.yourdomain.com   # CDN 加速域名
S3_PREFIX=uploads/
```

上传与生成图 URL 将直接返回 `S3_PUBLIC_URL` 前缀，前端 `assetUrl()` 已支持 `http(s)` 绝对地址。

## 12. 工作区协作

- Studio 侧栏：切换个人 / 团队工作区、新建团队、生成邀请链接
- 成员打开 `https://www.yourdomain.com/join?code=XXXXXXXX`
- API：`POST /workspaces/join`、`GET /workspaces/:id/members`
