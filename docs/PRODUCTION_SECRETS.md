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
| `API_PUBLIC_URL` | API 容器对外根地址，与上同源；Studio 工具将 `/uploads/...` 转为绝对 URL 供 Seedream 拉取 |
| `CORS_ORIGIN` | 前端源，如 `http://<IP>:3100` |
| `PUBLIC_WEB_URL` | 邮件/回调等，与前端一致 |

## P4 Provider 矩阵（`/opt/aimarket/.env`）

| 能力 | 变量 | 推荐生产（首期） | 接真能力时 |
|------|------|------------------|------------|
| 文生图 | `IMAGE_PROVIDER` | `mock` 或 `openai` | `openai` + `OPENAI_API_KEY` |
| Studio 工具总开关 | `TOOL_IMAGE_PROVIDER` | `auto`（各工具专用 mock） | 按供应商文档改 `auto` / 未来 `http` |
| 图像生成 | `IMAGE_PROVIDER` + `DASHSCOPE_API_KEY` / `OPENAI_API_KEY` | `mock` | `aliyun-wan`（wan2.6-t2i，¥0.2/张）/ `openai`（DALL·E 3） |
| 抠图 cutout | `TOOL_CUTOUT_PROVIDER` + `ARK_API_KEY`（推荐）或 `TOOL_CUTOUT_HTTP_URL` | `tool-cutout-mock` | `tool-seedream`（火山方舟 Seedream 5 编辑） / `tool-cutout-http`（自建网关 → fal BiRefNet / Photoroom / remove.bg） |
| 超分/增强 upscale·enhance | `TOOL_UPSCALE_PROVIDER` + `ARK_API_KEY` 或 `TOOL_UPSCALE_HTTP_URL` | `tool-upscale-mock` | `tool-seedream` / `tool-upscale-http`（Real-ESRGAN / Topaz / Magnific） |
| **扩图 expand** | `TOOL_EXPAND_PROVIDER` + `DASHSCOPE_API_KEY` 或 `TOOL_EXPAND_HTTP_URL` | `tool-edit-mock` | **`tool-wan-expand`**（万相 `wanx2.1-imageedit` + `function:expand`）/ **`tool-expand-http`**（FLUX Fill 等 outpaint 网关）/ 回落 `tool-seedream` |
| 局部 inpaint / 消除 erase | `TOOL_EDIT_PROVIDER` + `ARK_API_KEY` 或 `TOOL_EDIT_HTTP_URL` | `tool-edit-mock` | `tool-seedream` / `tool-edit-http` |
| 超分/增强 | （同上） | `tool-upscale-mock` | 第三方 upscale API |
| 提示词润色 | `PROMPT_OPTIMIZE_PROVIDER` | `auto` 或 `mock` | `auto`（有 `DASHSCOPE_API_KEY` 时优先百炼 `qwen-plus`；或 `openai` + `OPENAI_API_KEY`） |
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

## Agent 编排（P3，多实例可选 Redis）

| 变量 | 说明 |
|------|------|
| `AGENT_LLM_ENABLED` | `true` 启用 LLM 规划（需 `DEEPSEEK_API_KEY` 等） |
| `AGENT_CHECKPOINTER` | `memory`（单实例）\| `sqlite` \| `redis`（多 API 副本） |
| `REDIS_URL` | `AGENT_CHECKPOINTER=redis` 时必填；可与 `JOB_QUEUE=redis` 共用，需 **Redis Stack**（RediSearch） |
| `AGENT_CHECKPOINT_REDIS_TTL_MINUTES` | 可选 checkpoint TTL（分钟） |
| `AGENT_VLM_ENABLED` | 套图主图 VLM 选择、步骤质检（`AGENT_VLM_PROVIDER=auto`） |
| `INNGEST_EVENT_KEY` | 长 Skill 自托管 Inngest（见 `deploy/.env.production.example`） |

## 国内推荐方案（阿里百炼 + 火山方舟）

最少 2 个 Key 即可覆盖生成 + 编辑场景：

```bash
# 1. 图像生成走阿里 wan2.6-t2i
IMAGE_PROVIDER=aliyun_wan
DASHSCOPE_API_KEY=sk-xxx     # 阿里云百炼控制台 → API-KEY
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com
ALIYUN_WAN_MODEL=wan2.6-t2i
# 图生图（参考图生成）；IMAGE_PROVIDER=aliyun_wan 时优先于 Seedream
ALIYUN_WAN_I2I_MODEL=wan2.6-image

# 2. Studio 扩图（万相真扩图，推荐）
TOOL_EXPAND_PROVIDER=auto
ALIYUN_WAN_EXPAND_MODEL=wanx2.1-imageedit
# TOOL_EXPAND_HTTP_URL=https://your-outpaint-gateway/expand   # FLUX Fill / 自建

# 3. Studio 其他工具走火山方舟 Seedream 5
TOOL_CUTOUT_PROVIDER=auto
TOOL_UPSCALE_PROVIDER=auto
TOOL_EDIT_PROVIDER=auto
ARK_API_KEY=xxx              # 火山方舟控制台 → API Key
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
SEEDREAM_MODEL=doubao-seedream-5-0-260128
```

**扩图 `auto` 优先级**：`tool-wan-expand`（`DASHSCOPE_API_KEY`）→ `tool-expand-http`（`TOOL_EXPAND_HTTP_URL`）→ `tool-seedream`（`ARK_API_KEY`）→ mock。

**其他工具 `auto` 优先级**：vendor (Seedream/wan) > HTTP > mock。

**注意**：
- Seedream 5 通过 prompt 指令完成 cutout/upscale 等，效果不如专用 CV 模型（BiRefNet/Topaz），但**不需要额外申请阿里视觉智能 viapi**。
- 如需工业级抠图/超分，再加 `TOOL_CUTOUT_HTTP_URL` 指向自建网关接 fal/Photoroom。

## Studio 工具 HTTP 协议（真供应商接入）

所有 `tool-*-http` provider 统一协议（便于自建网关）：

```http
POST {TOOL_*_HTTP_URL}
Authorization: Bearer {TOOL_*_HTTP_KEY}
Content-Type: application/json

{
  "tool": "cutout",
  "prompt": "抠出主体，生成透明背景",
  "referenceUrls": ["https://.../source.jpg"],
  "count": 1,
  "resolution": "1k",
  "aspectRatio": "1:1"
}
```

扩图专用网关（`TOOL_EXPAND_HTTP_URL`）额外字段：

```json
{
  "tool": "expand",
  "function": "expand",
  "extend": { "direction": "left" },
  "extendScales": { "top_scale": 1, "bottom_scale": 1, "left_scale": 1.25, "right_scale": 1 },
  "outpaint": { "top_scale": 1, "bottom_scale": 1, "left_scale": 1.25, "right_scale": 1 }
}
```

兼容接口：`POST /api/v1/image/extendImage`（`extend` + `sourceOssId` / `assetId`）→ 内部 `toolType=expand`。

响应：

```json
{ "urls": ["https://cdn.example.com/result.png"], "mimeType": "image/png" }
```

错误（4xx/5xx 或缺失 `urls`）：

- `TOOL_*_PROVIDER=http`：抛错，任务失败 + 退积分
- `TOOL_*_PROVIDER=auto`：回落对应 `tool-*-mock`，任务仍成功

接入示例：在自建小服务里把 Replicate `BiRefNet` / 阿里抠图 / Picsart removebg 的厂商协议包成上述形状。

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

## 出图失败排查（运维）

创作台 **Auto 智能路由** 顺序：`Agnes → 万相 → Seedream`。上游 **5xx / 429** 会自动尝试下一 Provider；若全部失败，任务 `failed` 且积分退回。

常见错误：

| 现象 | 原因 | 处理 |
|------|------|------|
| `Agnes Image 失败 (500)` + `upstream_error` | Agnes 上游不稳定 | 通常 Auto 已回落万相/Seedream；持续失败检查 `AGNES_API_KEY` 与配额 |
| `SetLimitExceeded` / Seedream 429 | 火山方舟推理配额用尽 | 控制台调整限额或关闭 Safe Experience；图生图依赖 `ARK_API_KEY` |
| 画布无图、报错一闪而过 | 前端已修复为常驻 banner；旧版需重编 web | 合并含 `fix/generation-fallback-and-error-ui` 的 web 镜像 |

近 12 小时失败任务（CVM 上）：

```bash
docker cp aimarket-api:/app/data/aimarket.db /tmp/aimarket.db
docker cp aimarket-api:/app/data/aimarket.db-wal /tmp/aimarket.db-wal 2>/dev/null || true
sqlite3 /tmp/aimarket.db "PRAGMA wal_checkpoint(FULL);
  SELECT created_at, status, substr(error,1,200), substr(prompt,1,60)
  FROM generation_jobs WHERE status='failed' AND created_at > datetime('now','-12 hours')
  ORDER BY created_at DESC LIMIT 20;"
```

建议同时配置 `AGNES_API_KEY`、`DASHSCOPE_API_KEY`、`ARK_API_KEY`，提高 Auto 回落成功率。

### Studio 工具探活缓存（可选）

工具提交前会做配置检查 + 探活缓存（负缓存命中时同步失败，不入队）：

| 变量 | 默认 | 说明 |
|------|------|------|
| `TOOL_PROVIDER_HEALTH_CACHE_MS_OK` | `60000` | 探活成功缓存 TTL（ms） |
| `TOOL_PROVIDER_HEALTH_CACHE_MS_QUOTA` | `120000` | 配额/429 负缓存 TTL |
| `TOOL_PROVIDER_HEALTH_CACHE_MS_AUTH` | `300000` | 鉴权失败负缓存 TTL |
| `TOOL_PROVIDER_HEALTH_CACHE_MS_UNAVAILABLE` | `90000` | 上游 5xx 负缓存 TTL |

任务失败时也会回写缓存，避免重复空等轮询。

## 轮换与应急

1. 修改 `/opt/aimarket/.env` 中对应变量。
2. `docker compose ... restart aimarket-api`（无需重新 build 镜像，除非改了 `NEXT_PUBLIC_*` 需重编 web）。
3. 文生图 Key 泄露：轮换 OpenAI Key → 更新 `.env` → 重启 API。

回滚镜像见 [DEPLOY_CI.md](./DEPLOY_CI.md#镜像与磁盘清理)。

## 相关文档

- [DEPLOY_CI.md](./DEPLOY_CI.md) — CI/CD 与分支保护
- [STAGING.md](./STAGING.md) — 本地/预发 OpenAI 验证
- `deploy/.env.production.example` — 生产模板
