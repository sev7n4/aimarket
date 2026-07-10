# NeoWOW Workflow 深度复刻 — 主实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 深度复刻 NeoWOW `/workflow?sessionId=` 体验：工具节点图 + 生成链路 + Agent 对话操控，在 AIMarket `workflowShell` 上分期交付可验证增量。

**Architecture:** 方案 A（渐进增强）— 保留 CSS InfiniteCanvas，新增 `story-canvas` API 层镜像 NeoWOW，`workflow-tool-registry` 驱动节点类型，Agent 通过 workflow 专用 tools 委托生成，持久化扩展 `canvas_layout` v2。

**Tech Stack:** Next.js, InfiniteCanvas, CanvasAgentOp, Hono API, generation_jobs, Playwright E2E

**设计规格：** `docs/superpowers/specs/2026-07-09-neowow-workflow-deep-replica-design.md`

## Global Constraints

- 分支：`feature/neowow-workflows-list`（及后续 `feature/neowow-*` 子分支）
- 禁止直推 `main`；PR + CI（lint-typecheck / Integration / E2E）全绿
- 提交：`feat(scope): subject`；Squash merge
- 本地验证：`pnpm typecheck`；改 API 时 `pnpm test:integration`
- TDD：纯函数用 `scripts/test-*.ts`；UI 用 Playwright E2E
- 中文 UI 文案

---

## 文件结构总览

### Track A — 产品壳（Phase 1，大部分已完成）

| 文件 | 职责 |
|------|------|
| `apps/web/src/app/workflows/*` | 列表页 |
| `apps/web/src/components/workflows/WorkflowCard.tsx` | 卡片 |
| `apps/web/src/components/workflows/CreateWorkflowButton.tsx` | 新建 |
| `apps/web/src/components/app-left-rail.tsx` | 导航 |

### Track B — 无限画布（Phase 2b–2d）

| 文件 | 职责 |
|------|------|
| `apps/web/src/lib/workflow-tool-registry.ts` | 工具元数据 ✅ |
| `apps/web/src/lib/workflow-graph-sync.ts` | 连线→connectedUrls 纯函数 |
| `apps/web/src/lib/workflow-generation-poller.ts` | 前端轮询 |
| `apps/api/src/routes/story-canvas.ts` | story-canvas API 路由组 |
| `apps/api/src/lib/story-canvas-service.ts` | 生成/nodeKey/状态业务层 |
| `apps/api/src/lib/canvas-layout.ts` | 扩展 v2 workflowNodes/Edges |
| `apps/web/src/components/workflows/WorkflowToolPalette.tsx` | 调色板 ✅ |
| `apps/web/src/components/infinite-canvas/WorkflowToolNodeContent.tsx` | 工具节点 UI |

### Track C — Agent（Phase 2e–3b）

| 文件 | 职责 |
|------|------|
| `apps/web/src/components/infinite-canvas/agent/agent-tools.ts` | +5 workflow tools |
| `apps/web/src/components/infinite-canvas/agent/CanvasAssistantPanel.tsx` | 历史 Tab / 流式 |
| `apps/api/src/routes/workflow-agent.ts` | 会话历史 CRUD |
| `apps/api/src/db/migrations/*` | conversations/messages 表 |

---

## Phase 1 — 产品壳 MVP ✅

- [x] `/workflows` 列表页 + 搜索 + 新建
- [x] 左侧栏「工作流」入口
- [x] E2E `workflows-list.spec.ts`
- [ ] **Task 1.1 补强**：列表卡片展示封面缩略图（从 canvas_layout 首图）

---

## Phase 2b — 连线语义与图同步

### Task 2b.1: workflow-graph-sync 纯函数 + 单测

**Files:**
- Create: `apps/web/src/lib/workflow-graph-sync.ts`
- Create: `scripts/test-workflow-graph-sync.ts`

**Interfaces:**
- Consumes: `WorkflowToolId`, `CanvasNodeData`, `CanvasConnection`
- Produces: `injectConnectedUrls(nodes, edges): CanvasNodeData[]`

- [ ] **Step 1: 写失败测试** — image→image_to_video 边注入 `connectedImageUrls`
- [ ] **Step 2: 实现** `resolveUpstreamOutputs(nodeId, nodes, edges)`
- [ ] **Step 3: 运行** `pnpm --filter @aimarket/api exec sh -c 'TSX_TSCONFIG_PATH=../web/tsconfig.json tsx ../../scripts/test-workflow-graph-sync.ts'`

### Task 2b.2: 连线变更时自动注入

**Files:**
- Modify: `apps/web/src/hooks/use-design-canvas.tsx` — `onConnectionsChange` 仅在 `workflowShell`

**Interfaces:**
- Consumes: `injectConnectedUrls`
- Produces: 连线后下游节点 metadata 含 connected*Urls

- [ ] **Step 1: E2E** — 连接两节点后断言 metadata（或单测 snapshot）

---

## Phase 2c — story-canvas 生成 API

### Task 2c.1: canvas_layout v2 schema

**Files:**
- Modify: `apps/api/src/lib/canvas-layout.ts`
- Create: `apps/api/src/lib/workflow-graph-types.ts`

- [ ] **Step 1: 类型** `WorkflowNode`, `WorkflowEdge`, `layout.version` 支持 1|2
- [ ] **Step 2: 读写兼容** v1 会话无 workflowNodes 时正常

### Task 2c.2: story-canvas 路由骨架

**Files:**
- Create: `apps/api/src/routes/story-canvas.ts`
- Create: `apps/api/src/lib/story-canvas-service.ts`
- Modify: `apps/api/src/index.ts` — mount `/api/v1/story-canvas`

**Endpoints（MVP 子集）:**

```
POST /story-canvas/update-detail
POST /story-canvas/batch-operation
POST /story-canvas/generate-image      # TEXT_TO_IMAGE / IMAGE_TO_IMAGE
POST /story-canvas/generate-video      # TEXT_TO_VIDEO / IMAGE_TO_VIDEO
POST /story-canvas/outpainting         # 复用 expand tool
GET  /story-canvas/batch-query-status
GET  /story-canvas/latest-generation?nodeKey=
```

**Interfaces:**
- Consumes: `createGenerationJob`, `getJob`
- Produces: `{ nodeKey, jobId, status }`

- [ ] **Step 1: integration test** `scripts/test-story-canvas-generate.ts`
- [ ] **Step 2: 实现 generate-image** — body: `{ sessionId, nodeKey, prompt, referenceUrls? }`

### Task 2c.3: 前端节点「运行」按钮

**Files:**
- Create: `apps/web/src/components/infinite-canvas/WorkflowToolNodeContent.tsx`
- Modify: `apps/web/src/components/infinite-canvas/CanvasNode.tsx` — 渲染 workflowToolType 分支
- Create: `apps/web/src/lib/api/story-canvas.ts`

- [ ] **Step 1: 节点 UI** — idle 显示「运行」；pending 显示 spinner
- [ ] **Step 2: 调用** `POST /story-canvas/generate-*` 按 toolType 路由

---

## Phase 2d — 状态轮询

### Task 2d.1: batch-query-status API

**Files:**
- Modify: `apps/api/src/lib/story-canvas-service.ts`

- [ ] **Step 1: 按 nodeKeys 批量查 generation_jobs**
- [ ] **Step 2: 返回** `{ [nodeKey]: { status, outputUrl?, error? } }`

### Task 2d.2: 前端 poller

**Files:**
- Create: `apps/web/src/lib/workflow-generation-poller.ts`
- Modify: `apps/web/src/hooks/use-design-canvas.tsx` — workflowShell 时启动轮询

- [ ] **Step 1: 3s 间隔轮询 pending 节点**
- [ ] **Step 2: 更新节点 metadata.status + content/outputUrl**
- [ ] **Step 3: E2E** — mock job 完成后节点显示 success

---

## Phase 2e — Agent workflow 工具扩展

### Task 2e.1: 新增 5 个 Agent tools

**Files:**
- Modify: `apps/web/src/components/infinite-canvas/agent/agent-tools.ts`
- Modify: `apps/web/src/components/infinite-canvas/agent/online-agent-loop.ts` — onlineToolToOps

| 工具 | 说明 |
|------|------|
| `workflow_add_tool_node` | toolType + position → add_node with metadata |
| `workflow_connect_nodes` | from/to → connect_nodes + sync |
| `workflow_run_node` | nodeKey → 调 story-canvas generate |
| `workflow_query_status` | nodeKeys → 调 batch-query-status |
| `workflow_list_tools` | 返回 registry 列表 |

- [ ] **Step 1: 单测** `scripts/test-workflow-agent-tools.ts` — schema + onlineToolToOps
- [ ] **Step 2: 扩展 quick tags** — 「添加文生图节点」「连接选中节点并生成」

### Task 2e.2: Agent system prompt 更新

**Files:**
- Modify: `online-agent-loop.ts` — `CANVAS_AGENT_SYSTEM_PROMPT` 增加 workflow 段落

- [ ] **Step 1: E2E** — Agent 对话「帮我加一个文生图节点」→ 画布出现节点

---

## Phase 3 — 模板 / 分享 / Agent 历史

### Task 3.1: 模板反序列化（对标 NeoWOW template/use）

**Files:**
- Modify: `apps/api/src/routes/drama-templates.ts` 或新建 `workflow-templates.ts`
- Modify: `TemplateManager.tsx` — workflow 模式加载 workflowNodes

### Task 3.2: 分享克隆

**Files:**
- Create: `apps/api/src/routes/story-canvas-share.ts`
- Endpoints: `share/toggle`, `share/view`, `share/clone`

### Task 3.3: Agent 历史会话

**Files:**
- Create: `apps/api/src/routes/workflow-agent.ts`
- Modify: `CanvasAssistantPanel.tsx` — history Tab 接 API

---

## Phase 4 — 高级工具（按需）

- [x] IMAGE_OUTPAINTING / IMAGE_UPSCALE / LIGHTING / MUSIC / AUDIO — story-canvas 路由 (#332+)
- [ ] LIP_SYNC — 对接现有或新 provider
- [ ] POSE_REFERENCE / MOTION_CONTROL
- [ ] WORLD_MODEL — PlayCanvas 评估项，独立 spike

---

## Phase 3b — Agent 流式（待做）

- [ ] `POST /agent/tool-response/stream` SSE
- [ ] CanvasAssistantPanel 增量渲染

---

## 验收矩阵（NeoWOW 对标）

| NeoWOW 能力 | 负责 Track | Phase | 状态 |
|-------------|-----------|-------|------|
| /workflows 列表 | A | 1 | ✅ |
| /workflow 左右分栏 | A | 1 | ✅ |
| 工具调色板 | B | 2a | ✅ |
| 工具节点 25+ | B | 2c–4 | 9/25（9 种可跑通） |
| 连线输入注入 | B | 2b | ✅ |
| nodeKey 异步生成 | B | 2c–2d | ✅ |
| batch-query-status | B | 2d | ✅ |
| GeminiChatAgent | C | 2e | △ tool-response |
| Agent 历史 | C | 3 | ✅ |
| 流式响应 | C | 3b | ❌ |
| 模板画廊 | A/B | 3 | ✅ |
| 分享克隆 | A | 3 | ✅ |
| 列表封面缩略图 | A | 4c | ✅ |
| 3D World | — | 5+ | 非目标 |

---

## 执行建议

**推荐顺序：** 2b → 2c → 2d → 2e → 3（每条独立 PR，每 PR E2E 全绿）

**并行机会：**
- 2b（前端连线）与 2c（API 骨架）可并行，接口用 mock
- 2e（Agent tools）依赖 2c 的 `workflow_run_node` 委托层

**预估工期（单人）：**

| Phase | 工期 |
|-------|------|
| 2b | 3–4 天 |
| 2c | 5–7 天 |
| 2d | 2–3 天 |
| 2e | 3–4 天 |
| 3 | 5–7 天 |

---

## Self-Review（plan ↔ spec）

- [x] Spec §5 Track B → Tasks 2b–2d 覆盖
- [x] Spec §6 Track C → Tasks 2e, 3.3 覆盖
- [x] Spec §7 Track A → Phase 1 + Task 1.1
- [x] 无 TBD 占位符
- [x] 类型名一致：nodeKey, workflowToolType, WorkflowToolId
