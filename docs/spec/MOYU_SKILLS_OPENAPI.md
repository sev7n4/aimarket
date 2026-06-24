# 墨鱼π OpenAPI（moyu-skills）

> Phase C · PROD-C01。外部 Agent / OpenClaw 通过 API Key 创建与读取 Studio Session。

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

## 后续端点（PROD-C02 规划）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/open/drama/plan` | 异步规划 |
| POST | `/api/v1/open/drama/produce` | 确认制作 |
| POST | `/api/v1/open/webhooks` | 注册回调 |

## 本地开发

集成测试（需 API 进程）：

```bash
cd apps/api && pnpm exec tsx --env-file=.env src/index.ts
# 另一终端
pnpm --filter @aimarket/api exec tsx ../../scripts/test-open-api-sessions.ts
```

测试脚本通过 `createOpenApiKey` 在 SQLite 中签发临时 Key，无需手动配置环境变量。
