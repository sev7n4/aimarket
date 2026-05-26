# 生产密钥与环境变量（P4）

> **禁止**将真实密钥写入 Git、PR 描述、截图或日志。仅使用占位符与服务器本地 `.env`。

## 三层配置

| 层级 | 存放位置 | 用途 |
|------|----------|------|
| **GitHub Actions** | Environment `production` → Secrets | 部署 SSH、SMTP、构建时 `NEXT_PUBLIC_API_URL`（由 `TENCENT_CLOUD_IP` 推导） |
| **服务器运行时** | `/opt/aimarket/.env`（仅 CVM 本地） | API 业务密钥、OpenAI、S3、Stripe 等 |
| **仓库模板** | `.env.example`、`deploy/.env.production.example` | 变量名与说明，**无真实值** |

初始化服务器 `.env`：

```bash
cd /opt/aimarket
cp deploy/.env.production.example .env
# 编辑 .env，填入随机 JWT_SECRET / ADMIN_SECRET 与可选 OPENAI_API_KEY
docker compose -f deploy/docker-compose.prod.yml -f deploy/docker-compose.prod.images.yml restart aimarket-api
```

## GitHub Secrets（部署用，可复用 pintuotuo）

| Secret | 必填 | 说明 |
|--------|------|------|
| `TENCENT_CLOUD_IP` | ✅ | 公网 IP，用于 SSH 与 Web 构建 `NEXT_PUBLIC_API_URL` |
| `TENCENT_CLOUD_USER` | ✅ | SSH 用户（如 `root`） |
| `TENCENT_CLOUD_SSH_KEY` | ✅ | 私钥全文 |
| `SMTP_*` / `DEPLOYMENT_NOTIFICATION_EMAIL` | 可选 | 部署邮件通知 |

**不要**在 GitHub 存 `OPENAI_API_KEY`（除非团队统一用 Actions 注入；当前 workflow **不**向容器注入业务 Key，请在服务器 `.env` 配置）。

## 服务器 `.env` 必填项

| 变量 | 说明 |
|------|------|
| `JWT_SECRET` | 登录 JWT，≥32 字符随机 |
| `ADMIN_SECRET` | 管理接口 `X-Admin-Secret` |
| `NEXT_PUBLIC_API_URL` | 浏览器访问 API，如 `http://<IP>:4100` |
| `CORS_ORIGIN` | 前端源，如 `http://<IP>:3100` |
| `PUBLIC_WEB_URL` | 邮件/回调等，与前端一致 |

## P4 Provider 矩阵（`/opt/aimarket/.env`）

| 能力 | 变量 | 推荐生产（首期） | 接真能力时 |
|------|------|------------------|------------|
| 文生图 | `IMAGE_PROVIDER` | `mock` 或 `openai` | `openai` + `OPENAI_API_KEY` |
| Studio 工具总开关 | `TOOL_IMAGE_PROVIDER` | `auto`（各工具专用 mock） | 按供应商文档改 `auto` / 未来 `http` |
| 抠图 cutout | （随 `TOOL_IMAGE_PROVIDER`） | `tool-cutout-mock` | 第三方 matting API（待接） |
| 超分/增强 | （同上） | `tool-upscale-mock` | 第三方 upscale API |
| 扩图/局部 | （同上） | `tool-edit-mock` | outpaint/inpaint API |
| 提示词润色 | `PROMPT_OPTIMIZE_PROVIDER` | `auto` 或 `mock` | `openai` + `OPENAI_API_KEY` |
| 内容审核 | `MODERATION_PROVIDER` | `local` 或 `openai` | 视合规要求 |

OpenAI 相关（**仅服务器 `.env`**）：

```bash
OPENAI_API_KEY=sk-...          # 勿提交仓库
OPENAI_BASE_URL=               # 可选，兼容网关
OPENAI_IMAGE_MODEL=dall-e-3
OPENAI_CHAT_MODEL=gpt-4o-mini
OPENAI_MODERATION_MODEL=omni-moderation-latest
```

对象存储（出图持久化，可选）：

```bash
STORAGE_PROVIDER=s3
S3_BUCKET=...
S3_REGION=ap-guangzhou
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_PUBLIC_URL=https://...
```

## 部署后验证

```bash
# API 健康
curl -s http://<IP>:4100/health

# Provider 状态（需登录 token 或仅看公开字段）
curl -s http://<IP>:4100/api/v1/ai/providerStatus \
  -H "Authorization: Bearer <token>" | jq '.data | {image: .activeProvider, tools, promptOptimize}'
```

期望（默认 mock 生产）：

- `tools.cutoutProvider` → `tool-cutout-mock`
- `tools.upscaleProvider` → `tool-upscale-mock`
- `tools.expandProvider` → `tool-edit-mock`
- `promptOptimize.activeProvider` → `template-mock`（无 Key）或 `openai`（已配 Key）

## 轮换与应急

1. 修改 `/opt/aimarket/.env` 中对应变量。
2. `docker compose ... restart aimarket-api`（无需重新 build 镜像，除非改了 `NEXT_PUBLIC_*` 需重编 web）。
3. 文生图 Key 泄露：轮换 OpenAI Key → 更新 `.env` → 重启 API。

回滚镜像见 [DEPLOY_CI.md](./DEPLOY_CI.md#镜像与磁盘清理)。

## 相关文档

- [DEPLOY_CI.md](./DEPLOY_CI.md) — CI/CD 与分支保护
- [STAGING.md](./STAGING.md) — 本地/预发 OpenAI 验证
- `deploy/.env.production.example` — 生产模板
