# Staging 环境：真实图像出图（Sprint 2）

## 目标

在 staging / 本地验证 **OpenAI Images API** 真实出图，替代 Mock 占位图；失败时积分自动退回（已有逻辑）。

## 1. 环境变量（`apps/api` 或根目录 `.env`）

```bash
# 强制走 OpenAI（推荐 staging）
IMAGE_PROVIDER=openai

# 或自动：有 Key 用 OpenAI，否则 Mock
# IMAGE_PROVIDER=auto

OPENAI_API_KEY=sk-...
OPENAI_IMAGE_MODEL=dall-e-3

# 国内/代理网关（OpenAI 兼容接口）
# OPENAI_BASE_URL=https://your-gateway/v1

# 前端地址（CORS）
CORS_ORIGIN=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## 2. 启动

```bash
pnpm install
pnpm dev
```

修改 API 环境变量后**必须重启 API 进程**。

## 3. 验证步骤

1. 登录 → 打开 `/studio`
2. 画布上方横幅应显示 **「真实出图：OpenAI Images API」**（绿色）
3. 提交一句简单 prompt，如「一只橘猫坐在窗台上，写实摄影」
4. 等待任务完成（真实 API 可能 10–60s，**无 Mock 固定 2.5s 延迟**）
5. 画布/消息中的图片 URL 应为 `/uploads/xxx.png`（本地持久化）
6. 设置页 → 查看「当前图像引擎」说明

### 失败场景

- 未配置 Key 且 `IMAGE_PROVIDER=openai`：提交前应提示服务不可用；若已进入队列，失败消息含原因且**积分退回**
- Key 无效 / 余额不足：assistant 消息「生成失败：…，积分已退回」

## 4. 模式说明

| IMAGE_PROVIDER | 行为 |
|----------------|------|
| `mock` | 始终 Picsum 占位图 |
| `openai` | 必须配置 Key，否则 503 |
| `auto` | 有 Key 且模型支持 → OpenAI；否则 Mock |

## 5. 成本与限制

- DALL·E 3 按张计费，电商套图 4 张 = 4 次 API 调用
- 仅支持尺寸：`1024x1024`、`1024x1792`、`1792x1024`（由比例自动映射）
- Prompt 最长约 4000 字符

## 6. 生产建议

- `IMAGE_PROVIDER=openai` + 密钥走环境变量/密钥管理，勿提交仓库
- 配置 `JOB_QUEUE=redis` + `REDIS_URL` 避免重启丢任务
- 后续 Sprint：对象存储 COS/S3 替代本地 `uploads/`
- 生产密钥清单与 P4 Provider 矩阵见 **[PRODUCTION_SECRETS.md](./PRODUCTION_SECRETS.md)**

## 7. Studio 工具与提示词润色（P4）

本地默认各工具为 **专用 mock**（`TOOL_IMAGE_PROVIDER=auto`）：

| 工具 | mock 供应商 |
|------|-------------|
| cutout | `tool-cutout-mock` |
| upscale / enhance | `tool-upscale-mock` |
| expand / inpaint | `tool-edit-mock` |
| 其它 | `tool-mock` |

提示词润色 `POST /api/v1/prompt/optimize`：

```bash
PROMPT_OPTIMIZE_PROVIDER=auto   # 有 OPENAI_API_KEY 时走 Chat，否则 template-mock
OPENAI_CHAT_MODEL=gpt-4o-mini
```

响应含 `source`：`openai` | `template-mock`。`GET /api/v1/ai/providerStatus` → `promptOptimize`。
