# 墨鱼π OpenAPI（moyu-skills）

> Phase C · PROD-C01–C02。外部 Agent / OpenClaw 通过 API Key 创建 Session、规划与制作短剧。

## 鉴权

在请求头中携带 API Key（二选一）：

```http
X-Api-Key: moyu_sk_xxxxxxxx
```

或

```http
Authorization: Bearer moyu_sk_xxxxxxxx
```

Key 以 `moyu_sk_` 为前缀，与用户账号绑定。无效或已吊销的 Key 返回 `401 UNAUTHORIZED`。

## Base URL

| 环境 | URL |
|------|-----|
| 生产 | `http://119.29.173.89:4100` |
| 本地 | `http://localhost:4000` |

## Session

### 创建 Session

```http
POST /api/v1/open/sessions
Content-Type: application/json
X-Api-Key: moyu_sk_...

{
  "mode": "production",
  "title": "我的短剧项目",
  "kind": "canvas",
  "workspaceId": "可选 UUID"
}
```

| 字段 | 说明 |
|------|------|
| `mode` | `production`（默认推荐）\| `chat` \| `image` \| `ecommerce` |
| `kind` | `canvas`（默认）\| `project` |
| `title` | 可选，默认按 mode 生成 |
| `workspaceId` | 可选，默认用户个人空间 |

**响应 `201`**

```json
{
  "data": {
    "id": "uuid",
    "title": "我的短剧项目",
    "mode": "production",
    "kind": "canvas",
    "status": "idle",
    "workspaceId": "uuid",
    "createdAt": "2026-06-24T12:00:00.000Z",
    "updatedAt": "2026-06-24T12:00:00.000Z"
  }
}
```

### 读取 Session

```http
GET /api/v1/open/sessions/:id
X-Api-Key: moyu_sk_...
```

仅 Key 所属用户可访问其创建的 Session；否则 `404`。

## 短剧规划（异步）

```http
POST /api/v1/open/drama/plan
Content-Type: application/json
X-Api-Key: moyu_sk_...

{
  "sessionId": "uuid",
  "userIdea": "至少 10 字的创意描述",
  "targetDurationSec": 90,
  "aspectRatio": "9:16",
  "autoProduce": false,
  "projectType": "short_drama"
}
```

| 字段 | 说明 |
|------|------|
| `sessionId` | 已创建的 Open Session |
| `userIdea` | 10–2000 字 |
| `targetDurationSec` | 60–180，可选 |
| `aspectRatio` | `9:16` \| `16:9`，可选 |
| `autoProduce` | 规划完成后自动进入制作（默认 `false`） |
| `projectType` | `short_drama` \| `mv` \| `creative` |

**响应 `201`**：与 `POST /api/v1/drama/plan/runs` 相同（`data` 为 plan run 序列化对象）。规划在后台执行，可通过 Studio SSE 或 Webhook 获取完成通知。

## 确认制作

```http
POST /api/v1/open/drama/produce
Content-Type: application/json
X-Api-Key: moyu_sk_...

{
  "sessionId": "uuid",
  "projectId": "uuid",
  "confirmed": true
}
```

角色须已定稿（三视图 locked）后再调用。**响应 `201`**：与 `POST /api/v1/drama/projects/:id/produce` 相同。

## Webhook

```http
POST /api/v1/open/webhooks
Content-Type: application/json
X-Api-Key: moyu_sk_...

{
  "url": "https://your-agent.example/hooks/moyu",
  "events": ["drama.plan.completed", "drama.run.completed"],
  "secret": "可选，用于 HMAC 签名校验"
}
```

| 事件 | 触发时机 |
|------|----------|
| `drama.plan.completed` | 多 Agent 规划成功 |
| `drama.plan.failed` | 规划失败 |
| `drama.run.completed` | 制作 Run 完成 |
| `drama.run.failed` | 制作 Run 失败 |

回调 `POST` 请求体：

```json
{
  "event": "drama.plan.completed",
  "timestamp": "2026-06-24T12:00:00.000Z",
  "data": {
    "planRunId": "uuid",
    "sessionId": "uuid",
    "projectId": "uuid",
    "status": "completed"
  }
}
```

若注册时提供了 `secret`（或未提供时服务端自动生成），响应会**一次性**返回 `secret`；后续请求带 `X-Moyu-Signature: sha256 HMAC`（hex）。

## 本地开发

集成测试（需 API 进程）：

```bash
cd apps/api && pnpm exec tsx --env-file=.env src/index.ts
# 另一终端
pnpm --filter @aimarket/api exec tsx ../../scripts/test-open-api-sessions.ts
pnpm --filter @aimarket/api exec tsx ../../scripts/test-open-api-drama.ts
```

测试脚本通过 `createOpenApiKey` 在 SQLite 中签发临时 Key，无需手动配置环境变量。
