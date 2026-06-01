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
| 扩图/局部 expand·inpaint | `TOOL_EDIT_PROVIDER` + `ARK_API_KEY` 或 `TOOL_EDIT_HTTP_URL` | `tool-edit-mock` | `tool-seedream` / `tool-edit-http`（FLUX.1 Fill / Ideogram Canvas） |
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

# 2. Studio 工具走火山方舟 Seedream 5
TOOL_CUTOUT_PROVIDER=auto
TOOL_UPSCALE_PROVIDER=auto
TOOL_EDIT_PROVIDER=auto
ARK_API_KEY=xxx              # 火山方舟控制台 → API Key
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
SEEDREAM_MODEL=doubao-seedream-5-0-260128
```

**`auto` 优先级**：vendor (Seedream/wan) > HTTP > mock。即配 Key 后**所有工具自动切真供应商**，不需要逐工具开关。

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

## 轮换与应急

1. 修改 `/opt/aimarket/.env` 中对应变量。
2. `docker compose ... restart aimarket-api`（无需重新 build 镜像，除非改了 `NEXT_PUBLIC_*` 需重编 web）。
3. 文生图 Key 泄露：轮换 OpenAI Key → 更新 `.env` → 重启 API。

回滚镜像见 [DEPLOY_CI.md](./DEPLOY_CI.md#镜像与磁盘清理)。

## 相关文档

- [DEPLOY_CI.md](./DEPLOY_CI.md) — CI/CD 与分支保护
- [STAGING.md](./STAGING.md) — 本地/预发 OpenAI 验证
- `deploy/.env.production.example` — 生产模板
