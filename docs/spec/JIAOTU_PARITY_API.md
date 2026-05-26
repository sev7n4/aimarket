# AIMarket 椒图对标 — 接口文档设计（草案）


| 项目     | 内容                                                   |
| ------ | ---------------------------------------------------- |
| 版本     | v0.2（草案，含架构优化）                                       |
| 基线     | 竞品调研 + **优化方案** `docs/spec/JIAOTU_OPTIMIZED_DESIGN.md` |
| API 前缀 | `/api/v1`                                            |
| 鉴权     | 默认 `Authorization: Bearer <JWT>`；标注「公开」的接口除外         |
| 响应包络   | 与现网一致：`{ data: T }` 或 `{ error: { code, message } }` |


---

## 0. Canonical API vs 椒图别名（重要）

**推荐实现顺序**：先落地 **Canonical（稳定）**，再按需挂载 **Alias（兼容）**。

| 能力 | Canonical（AIMarket 主路径） | 椒图别名（可选，`COMPAT_JIAOTU_ALIASES`） |
|------|------------------------------|------------------------------------------|
| 灵感列表/详情 | `GET /inspiration/page`、`GET /inspiration/:id` | `GET /keyword/page`、`GET /keyword/detail/:id` |
| 主生成 | `POST /ai/generate` | — |
| 流式进度 | `GET /ai/jobs/:jobId/stream` | 不对标 `imageChat` |
| 任务状态 | `GET /ai/jobs/:jobId` | `GET /imageTask/taskStatus`（转发） |
| Studio 工具 | `POST /tools/:toolId/run` | `POST /image/extendImage` 等（转发到 toolId） |
| 预签名上传 | `POST /assets/upload-url` + `POST /assets/confirm` | `POST /upload/token` + `POST /upload/callback` |
| Prompt 润色 | `POST /prompt/optimize` | 同名 |

下文「对标 `keyword`」「对标 `image/*`」章节描述 **别名层的请求/响应形状**；实现时由 adapter 映射到 Canonical。

---

## 1. 设计原则

1. **统一 Job 内核**：所有出图走 `createGenerationJob` + `GET /ai/jobs/:id/stream`（见优化方案文档）。
2. **产品体验对齐椒图**：灵感灌入、Dock 工具、积分预估、润色。
3. **渐进落地**：P0 可 Mock/SQLite；P4 再接真实 Provider。
4. **工具以注册表扩展**：`lib/tools.ts` + `inputSchema`，**不**默认新增 10 条一等公民 `/image/*` 路由。
5. **别名可选**：仅在外部兼容需要时启用转发。
6. **不引入 Go**：全部在 `apps/api`（Hono + TypeScript）实现。

---

## 2. 灵感发现

### 2.0 Canonical

`GET /api/v1/inspiration/page` · `GET /api/v1/inspiration/:id`

**详情 `data`（推荐）**

```typescript
{
  id: string;
  title: string;
  category: string;
  promptTemplate: string;
  variables?: Array<{ key: string; label: string; default: string }>;
  modelId: string;
  aspectRatio: string;
  resolution: string;
  coverUrl: string;
  referenceAssets: Array<{ assetId?: string; url: string }>;
}
```

服务端可将 `promptTemplate` + `variables` 渲染为 `prompt` 字符串供前端直接使用。

### 2.1 分页列表（公开，椒图别名）

`GET /api/v1/keyword/page`


| 参数       | 类型     | 必填  | 说明          |
| -------- | ------ | --- | ----------- |
| pageNum  | number | 否   | 默认 1        |
| pageSize | number | 否   | 默认 30，最大 50 |


**响应 `data`**

```typescript
{
  total: number;
  rows: Array<{
    id: number;
    keywords: string;      // 卡片标题/分类
    picture: string;       // 封面 URL
    createTime?: string;
    updateTime?: string;
  }>;
}
```

### 2.2 详情（公开）

`GET /api/v1/keyword/detail/:id`

**响应 `data`**

```typescript
{
  id: number;
  keywords: string;
  prompt: string;              // 运营预置完整模板
  modelId: string;             // 对齐 queryModels 的 id（AIMarket 用 string uuid 或数字映射表）
  size: string;                // 比例：auto | 1:1 | 9:16 | ...
  qualityLevel: string;        // 1K | 2K | 4K
  picture: string;
  imagesList: Array<{
    ossId?: string;
    url: string;
    fileName?: string;
  }> | null;
  isMapping?: boolean;
}
```

**业务规则**

- `imagesList` 为空时，服务端 **建议** 将 `picture` 转为单元素 `imagesList`，保证前端 `manualFile` 一致（椒图部分案例行为）。
- `prompt` 内 `{argument name="..." default="..."}` 原样返回，前端展示前可做简单替换。

### 2.3 管理端（P2，可选）


| 方法     | 路径                          | 说明     |
| ------ | --------------------------- | ------ |
| POST   | `/api/v1/admin/keyword`     | 创建灵感条目 |
| PUT    | `/api/v1/admin/keyword/:id` | 更新     |
| DELETE | `/api/v1/admin/keyword/:id` | 删除     |


---

## 3. 模型与计费（已有，补充对齐字段）

### 3.1 模型列表

`GET /api/v1/ai/queryModels` — **已有**（`apps/api` models 路由）

**建议扩展字段（与椒图对齐）**

```typescript
{
  id: string;
  showModelName: string;
  description: string;
  type: "image" | "video";     // 映射椒图 type 1/2/3/4
  resolutionList: Array<{ label: string; value: string | null }>;
  qualityLevelList: Array<{ label: string; value: string }>;
  imageSize: number;           // 最大参考图张数
  pointsFactor: number;
  ifDefault?: boolean;
}
```

### 3.2 单模型

`GET /api/v1/ai/queryModel?modelId=` — **新增别名**（可选，转发到现有 models 详情）

### 3.3 积分预估

`POST /api/v1/ai/estimatePointsBatch` — **已有**

---

## 4. 主创作流

### 4.1 对话生成（REST，当前）

`POST /api/v1/ai/generate` — **已有**


| 字段                 | 说明              |
| ------------------ | --------------- |
| sessionId          | UUID            |
| prompt             | 文本              |
| modelId            | 可选，空则 autoRoute |
| count              | 1–4             |
| resolution         | 1k/2k/4k        |
| aspectRatio        | auto + 各比例      |
| assetIds           | 附件              |
| referenceOutputIds | @ 历史图           |
| autoRoute          | boolean         |


**响应**：`{ jobId, estimatedPoints, modelId?, routeReason? }`

### 4.2 对话生成（SSE，对标 imageChat）

`POST /api/v1/ai/imageChat` — **新增（P2）**


| 项            | 说明                                                     |
| ------------ | ------------------------------------------------------ |
| Content-Type | `application/json`                                     |
| Accept       | `text/event-stream`                                    |
| Body         | 与 generate 类似，增加 `requestMode`: `standard` | `quick`   |
| 事件           | `message` / `job` / `image` / `[DONE]`（需在实现时固定 schema） |


**过渡方案**：`imageChat` 内部调用现有 job 队列，SSE 推送 job 状态与 output URL。

### 4.3 Prompt 润色

`POST /api/v1/prompt/optimize` — **新增（P1）**

```typescript
// Request
{ prompt: string; mode?: "chat" | "quick" | "ecommerce" }

// Response
{ data: { prompt: string } }
```

实现：先模板/规则；后接 LLM Provider。

### 4.4 任务状态


| 方法  | 路径                                     | 状态                    |
| --- | -------------------------------------- | --------------------- |
| GET | `/api/v1/ai/jobs/:jobId`               | 已有（轮询）                |
| GET | `/api/v1/ai/jobs/:jobId/stream`        | 已有（SSE）               |
| GET | `/api/v1/imageTask/taskStatus?taskId=` | **新增别名**（P1，转发到 jobs） |


---

## 5. 上传（对标 COS）

### 5.1 获取上传凭证

`POST /api/v1/upload/token` — **新增（P1）**

```typescript
// Request
{
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sessionId?: string;
}

// Response
{
  uploadUrl: string;      // 预签名 PUT 或 POST policy
  ossId: string;          // 资产 ID，callback 前可占位
  headers?: Record<string, string>;
  expireAt: string;
}
```

### 5.2 上传完成回调

`POST /api/v1/upload/callback` — **新增（P1）**

```typescript
// Request
{
  ossId: string;
  sessionId?: string;
  url: string;            // 可访问 URL
  fileName: string;
  sizeBytes: number;
}

// Response
{ assetId: string; url: string }
```

**P1 实现**：本地存储可模拟 `uploadUrl` 指向 `POST /api/v1/assets`。

---

## 6. 画布工具 API（对标 `/image/`*）

统一异步模式：

1. 创建 `generation_jobs`（`tool_type` = 工具名）。
2. 返回 `{ taskId, estimatedPoints }`（`taskId` 即 `jobId`）。
3. 客户端轮询 `imageTask/taskStatus` 或 `ai/jobs/:id`。

### 6.1 接口一览


| 椒图路径                      | AIMarket 路径（建议） | tool_type | 请求要点                               |
| ------------------------- | --------------- | --------- | ---------------------------------- |
| `/image/extendImage`      | 同左              | `expand`  | sessionId, ossId/蒙版, prompt?, 扩展方向 |
| `/image/upscaling`        | 同左              | `upscale` | multipart: file + scale?           |
| `/image/enhance`          | 同左              | `enhance` | sessionId, ossId                   |
| `/image/removeBackground` | 同左              | `erase`   | sessionId, mask/ossId（消除）          |
| `/image/cutout`           | 同左              | `cutout`  | sessionId, ossId                   |
| `/image/partialEdit`      | 同左              | `inpaint` | sessionId, mask, prompt            |
| `/image/editText`         | 同左              | `text`    | sessionId, regions[], newText      |
| `/image/uploadGenerate`   | 同左              | `blend`   | sessionId, ossIds[], prompt        |


### 6.2 请求体（通用 JSON 工具）

`POST /api/v1/image/extendImage` 示例：

```typescript
{
  sessionId: string;          // UUID
  sourceOssId: string;        // 主图 asset/output
  prompt?: string;
  mask?: string;              // base64 或 ossId，P2
  extend?: { top?: number; right?: number; bottom?: number; left?: number };
  resolution?: "1k" | "2k" | "4k";
}
```

`POST /api/v1/image/upscaling`：**multipart/form-data**


| 字段        | 说明        |
| --------- | --------- |
| file      | 图片文件      |
| sessionId | UUID      |
| scale     | 2 | 4（可选） |


### 6.3 兼容层

保留 `POST /api/v1/tools/:toolId/run`，body 增加可选字段：

```typescript
{
  sessionId: string;
  prompt?: string;
  assetIds?: string[];
  mask?: string;
  // ...
}
```

内部映射到上表专用路由。

### 6.4 图生文（P3）


| 方法   | 路径                                           |
| ---- | -------------------------------------------- |
| POST | `/api/v1/image/originalImagePromptReverse`   |
| POST | `/api/v1/image/templateSummaryPromptReverse` |


---

## 7. 会话与画布（已有，命名对齐）


| 椒图             | AIMarket 现有                     | 动作  |
| -------------- | ------------------------------- | --- |
| imageSession/* | imageSession/*                  | 已对齐 |
| image/list     | 可合并 references + outputs        | P2  |
| canvas 布局      | GET/PUT imageSession/:id/canvas | 已有  |


---

## 8. 错误码（沿用）


| code                 | HTTP | 说明       |
| -------------------- | ---- | -------- |
| VALIDATION_ERROR     | 400  | zod 校验失败 |
| UNAUTHORIZED         | 401  | 未登录      |
| INSUFFICIENT_CREDITS | 402  | 积分不足     |
| NOT_FOUND            | 404  | 资源不存在    |
| USE_VIDEO_ENDPOINT   | 400  | 视频走错接口   |
| INTERNAL_ERROR       | 500  | 服务器错误    |


---

## 9. 实现阶段与接口开关


| 阶段  | 接口范围                                              | Provider      |
| --- | ------------------------------------------------- | ------------- |
| P0  | inspiration/* + keyword 别名 + 前端灌入                 | DB seed + 静态图 |
| P1  | assets/upload-url、prompt/optimize、taskStatus 别名   | object-storage + 规则润色 |
| P2  | tools 注册表扩展 + inputSchema + Dock；image/* 别名 **可选** | mock provider |
| P3  | 图生文 `image/prompt-reverse`；强化 job SSE 前端默认接入      | 可选 LLM      |
| P4  | 按 `ToolDefinition.providerKey` 接真供应商              | 按工具接入         |


环境变量建议：

- `INSPIRATION_SOURCE=api|static`（默认 static，P0 后 api）
- `COMPAT_JIAOTU_ALIASES=false|true`（默认 false）
- `USE_JOB_STREAM=true`（前端默认 SSE，不对标 imageChat）

---

## 10. OpenAPI

P1 完成后从 `apps/api/src/routes` 生成 OpenAPI 片段，合并入 `docs/TECH_SPEC.md` 第 6 节。