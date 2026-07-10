# NeoWOW 画布基本操作深度复刻 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 对标 NeoWOW `/workflow?sessionId=` 左下角「?」胶囊「画布使用指南」中的基本操作能力与页面布局，补齐 AIMarket workflow 画布交互缺口，并与 story-canvas 生成链路打通。

**Architecture:** 延续方案 A（CSS InfiniteCanvas 渐进增强），新增 `canvas-interaction` 纯函数层承载复制/粘贴/适应视图/网格吸附；左下角 `CanvasGuideCapsule` 复刻 NeoWOW 帮助入口；workflow 模式专用顶栏与控件布局；后端补齐 `update-detail` / `batch-operation` 图同步 API。

**Tech Stack:** Next.js 15, React 19, InfiniteCanvas (CSS transform), Hono, SQLite, Playwright E2E

**关联规格：**
- `docs/superpowers/specs/2026-07-09-neowow-workflow-deep-replica-design.md`
- `docs/superpowers/plans/2026-07-09-neowow-workflow-deep-replica.md`

## Global Constraints

- 分支：`feature/neowow-canvas-basics`（子任务可 `feature/neowow-canvas-*`）
- 禁止直推 `main`；PR + CI 全绿
- 本地验证：`pnpm typecheck`；改 API 时 `pnpm test:integration`
- TDD：纯逻辑 `scripts/test-*.ts`；交互 Playwright E2E
- 中文 UI 文案；帮助文案与 NeoWOW 指南结构对齐

---

## 0. 逆向取证结论（NeoWOW 画布基本能力蒸馏）

> 目标页 `https://neowow.cn/workflow?sessionId=2075430725148319744` 需登录，无法直接抓取弹层文案。以下基于既有反编译规格 + Vue Flow 工作流画布通用模式 + 同类产品指南结构蒸馏。

### 0.1 左下角「?」胶囊 — 画布使用指南（章节结构）

| 章节 | NeoWOW 典型内容 | AIMarket 现状 |
|------|----------------|---------------|
| **一、画布导航** | 滚轮缩放；Space/中键/右键拖动画布；双击空白；适应视图；小地图 | 滚轮/Space/中键 ✅；适应视图 ❌（仅重置 1x）；帮助在右下 |
| **二、节点操作** | 单击选中；Shift/Cmd 多选；框选；拖拽移动；Shift 约束轴向；网格吸附 | 选中/框选/拖拽 ✅；轴向约束 ❌；网格吸附 ❌ |
| **三、连线** | 输出 handle → 输入 handle；删除连线；类型提示 | 左右圆点 handle △；无类型校验提示 |
| **四、编辑** | 复制/粘贴；全选；删除；撤销/重做；分组 | 撤销/重做 ✅；复制/粘贴/全选 ❌（快捷键弹窗有文案但未实现） |
| **五、运行** | 单节点运行；Run All 整条链路 | 单节点运行 △（近期 API 扩展中）；Run All ❌ |
| **六、快捷创建** | 右键菜单 / 左栏拖入 / 双击空白 | 左栏点击添加 ✅；右键/双击 ✅ |
| **七、保存** | Ctrl+S 手动保存；自动保存提示 | debounce 持久化 △；无显式保存反馈 |

### 0.2 页面布局对标

```
┌──────────────────────────────────────────────────────────────────┐
│ 顶栏：返回 / 标题 / 保存状态 / Run All / 分享 / 积分              │
├────────┬─────────────────────────────────────────┬───────────────┤
│ 工具   │                                         │               │
│ 调色板 │           无限画布 + 节点图              │  Agent 对话   │
│ (左)   │                                         │  (右 docked)  │
│        │  [? 指南胶囊]              [小地图/缩放] │               │
└────────┴─────────────────────────────────────────┴───────────────┘
```

AIMarket 现状：左调色板 ✅、右 Agent ✅；顶栏 workflow 专用条 ❌；左下指南胶囊 ❌；右下缩放条 ✅。

---

## 文件结构总览（本计划新增/修改）

| 文件 | 职责 |
|------|------|
| `apps/web/src/lib/canvas-interaction.ts` | 复制/粘贴/全选/fitView/网格吸附 纯函数 |
| `apps/web/src/lib/canvas-clipboard.ts` | 节点+连线剪贴板序列化 |
| `apps/web/src/lib/canvas-viewport.ts` | `computeFitViewport(nodes, rect)` |
| `apps/web/src/components/infinite-canvas/CanvasGuideCapsule.tsx` | 左下角 ? 胶囊 + 指南弹层 |
| `apps/web/src/components/infinite-canvas/CanvasZoomControls.tsx` | 迁移帮助入口；增加 fit 按钮 |
| `apps/web/src/components/workflows/WorkflowTopBar.tsx` | workflow 顶栏（标题/保存/Run All） |
| `apps/web/src/components/infinite-canvas/InfiniteCanvasContainer.tsx` | 轴向约束拖拽、网格吸附、键盘扩展 |
| `apps/web/src/hooks/use-design-canvas.tsx` | 接线 copy/paste/selectAll/fitView/runAll |
| `apps/web/src/lib/workflow-graph-sync.ts` | 连线类型校验 + connectedUrls 注入 |
| `apps/api/src/routes/story-canvas.ts` | +update-detail, +batch-operation |
| `apps/api/src/lib/story-canvas-graph-sync.ts` | 图增量同步业务层 |
| `apps/web/e2e/workflow-canvas-basics.spec.ts` | 基本操作 E2E |

---

## Phase 0 — 逆向取证补强（0.5–1 天）

### Task 0.1: 登录态抓取 NeoWOW 指南原文

**Files:**
- Create: `docs/superpowers/research/2026-07-10-neowow-canvas-guide-screenshots.md`

- [ ] **Step 1:** 使用有效账号打开目标 workflow URL
- [ ] **Step 2:** 点击左下角 ? 胶囊，截图 + 逐条记录指南章节与快捷键
- [ ] **Step 3:** 更新差距矩阵（本节 0.1 表格），标注「已验证 / 推测」

### Task 0.2: 差距矩阵锁定验收标准

- [ ] **Step 1:** 与产品确认 P0 能力清单（建议：导航 + 选择 + 复制粘贴 + 连线 + 单节点运行）
- [ ] **Step 2:** 将 P0 清单写入 `2026-07-09-neowow-workflow-deep-replica-design.md` §9 成功标准

---

## Phase 2.5 — 画布基本操作（前端，5–7 天）

### Task 2.5.1: fitView 适应视图

**Files:**
- Create: `apps/web/src/lib/canvas-viewport.ts`
- Create: `scripts/test-canvas-viewport.ts`
- Modify: `apps/web/src/components/infinite-canvas/InfiniteCanvasContainer.tsx`
- Modify: `apps/web/src/components/infinite-canvas/CanvasZoomControls.tsx`

**Interfaces:**
- Produces: `computeFitViewport(nodes: CanvasNodeData[], containerRect: DOMRect, padding?: number): ViewportTransform`

- [x] **Step 1: 写失败测试** — 两个相距节点应计算出 k<1 且居中
- [x] **Step 2: 实现** `computeFitViewport`
- [x] **Step 3: 绑定快捷键** `Ctrl/Cmd+0` 与 `F`（非输入框时）
- [x] **Step 4: ZoomControls 增加「适应」按钮**（Focus 图标旁）

### Task 2.5.2: 复制 / 粘贴 / 全选

**Files:**
- Create: `apps/web/src/lib/canvas-clipboard.ts`
- Create: `scripts/test-canvas-clipboard.ts`
- Modify: `apps/web/src/hooks/use-design-canvas.tsx`

**Interfaces:**
- Produces:
  - `serializeSelection(nodes, connections, selectedIds): CanvasClipboardPayload`
  - `pasteClipboard(payload, offset): { nodes, connections }`
  - `selectAllNodeIds(nodes): string[]`

- [x] **Step 1: 测试** — 复制 2 节点 + 1 连线，粘贴后 ID 重新生成、连线重映射
- [x] **Step 2: 实现** Ctrl/Cmd+C/V/A（infinite + workflowShell）
- [x] **Step 3: 右键菜单** 增加「复制」「粘贴」

### Task 2.5.3: 拖拽增强（轴向约束 + 网格吸附）

**Files:**
- Modify: `apps/web/src/components/infinite-canvas/InfiniteCanvasContainer.tsx`
- Create: `apps/web/src/lib/canvas-interaction.ts`

- [x] **Step 1:** Shift+拖拽锁定水平或垂直（对比起始位移量）
- [x] **Step 2:** `L` 切换网格吸附（默认 20px，与 FreeCanvas 一致）
- [x] **Step 3:** 吸附仅 workflowShell 默认开启（可配置）

### Task 2.5.4: 左下角 CanvasGuideCapsule

**Files:**
- Create: `apps/web/src/components/infinite-canvas/CanvasGuideCapsule.tsx`
- Modify: `apps/web/src/components/infinite-canvas/InfiniteCanvasContainer.tsx`
- Modify: `apps/web/src/components/infinite-canvas/CanvasZoomControls.tsx` — 移除 HelpCircle 或保留为快捷入口

**UI 规格:**
- 位置：左下角，距底 `12px + overlayBottomInsetPx`，z-50
- 样式：圆角胶囊 `?` +「使用指南」；深色半透明底
- 弹层：分 7 章（对齐 §0.1），底部列出完整快捷键表

- [x] **Step 1:** 组件 + Storybook/单测快照（章节标题 data-testid）
- [x] **Step 2:** workflowShell 模式显示；Studio 模式可选隐藏
- [x] **Step 3:** E2E 点击胶囊 → 弹层可见 → Esc 关闭

### Task 2.5.5: 连线类型校验与视觉反馈

**Files:**
- Modify: `apps/web/src/lib/workflow-graph-sync.ts`
- Modify: `apps/web/src/lib/workflow-tool-registry.ts` — 增加 `inputTypes` / `outputTypes`
- Modify: `apps/web/src/components/infinite-canvas/InfiniteCanvasContainer.tsx`

- [ ] **Step 1:** `canConnect(sourceTool, targetTool): boolean` 纯函数 + 测试
- [ ] **Step 2:** 非法连线拖拽时 handle 变红 + toast「该工具不接受此输入」
- [ ] **Step 3:** 合法连线后触发 `injectConnectedUrls`（衔接 Phase 2b）

---

## Phase 2.6 — Workflow 页面布局对齐（2–3 天）

### Task 2.6.1: WorkflowTopBar

**Files:**
- Create: `apps/web/src/components/workflows/WorkflowTopBar.tsx`
- Modify: `apps/web/src/components/studio-workspace.tsx`
- Modify: `apps/web/src/app/workflow/workflow-page-client.tsx`

**布局:**
- 左：返回 `/workflows`、可编辑标题
- 中：保存状态（「已保存」/「保存中…」）
- 右：Run All、分享（复用 WorkflowShareButton）、设置

- [ ] **Step 1:** 顶栏仅 `workflowShell` 显示
- [ ] **Step 2:** 标题 inline 编辑 → `PATCH imageSession` 或现有 update API
- [ ] **Step 3:** E2E 顶栏元素可见

### Task 2.6.2: 控件位置重排

**Files:**
- Modify: `apps/web/src/components/infinite-canvas/infinite-canvas-layout.ts`
- Modify: `apps/web/src/components/infinite-canvas/CanvasMiniMap.tsx`

- [ ] **Step 1:** 小地图保持右下；指南胶囊左下（与 NeoWOW 一致）
- [ ] **Step 2:** workflow 模式隐藏 Studio 冗余 chrome（OrchestrationDock 等）

---

## Phase 2b–2d — 图语义与生成链路（延续主计划，更新进度）

> 详见 `2026-07-09-neowow-workflow-deep-replica.md`。本节仅列与「基本能力」交叉的增量。

| 任务 | 状态（2026-07-10） | 下一步 |
|------|-------------------|--------|
| 2b workflow-graph-sync | 文件存在，接线待验证 | 与 2.5.5 类型校验合并 PR |
| 2c story-canvas API | generate-image/video + 5 工具端点已加（未提交） | 补 update-detail / batch-operation |
| 2d batch-query-status | 路由存在 | 前端 poller 与节点 UI 状态联动 |
| 2c 前端运行按钮 | WorkflowToolNodeContent 存在 | 接入 story-canvas-run 路由表 |

### Task 2b.3: story-canvas 图同步 API

**Files:**
- Create: `apps/api/src/lib/story-canvas-graph-sync.ts`
- Modify: `apps/api/src/routes/story-canvas.ts`

```
POST /story-canvas/update-detail   # 全量/增量 nodes+edges+viewport
POST /story-canvas/batch-operation # 批量 add/update/delete/connect
```

- [ ] **Step 1:** integration test `scripts/test-story-canvas-graph-sync.ts`
- [ ] **Step 2:** 写入 `canvas_layout` v2（workflowNodes/Edges）
- [ ] **Step 3:** 前端 debounce 3s 调用 update-detail（workflowShell）

### Task 2d.3: Run All 整条工作流

**Files:**
- Modify: `apps/web/src/hooks/use-design-canvas.tsx`
- Create: `apps/web/src/lib/workflow-topo-sort.ts`

- [ ] **Step 1:** `topoSortWorkflowNodes(nodes, edges)` 纯函数 + 环检测
- [ ] **Step 2:** Run All 按拓扑序依次 `handleRunWorkflowNode`（上游 success 后才跑下游）
- [ ] **Step 3:** 顶栏 Run All 按钮 + 进度指示

---

## Phase 2e — Agent 画布操控（3–4 天）

> 延续主计划 Task 2e.1–2e.2。与基本操作交叉点：

- [ ] Agent 工具 `workflow_add_tool_node` 创建的节点位置应避开当前选区（调用 `computeFitViewport` 或视口中心）
- [ ] 指南胶囊文案写入 Agent system prompt，Agent 可回答「怎么框选」「怎么 Run All」

---

## Phase 3 — 产品壳增强（5–7 天，可并行）

- 模板反序列化、分享克隆、Agent 历史会话（见主计划 Phase 3）
- 列表卡片封面缩略图（Task 1.1）

---

## 验收矩阵（画布基本能力）

| 能力 | Phase | 验收方式 |
|------|-------|----------|
| 左下 ? 指南胶囊 + 7 章弹层 | 2.5.4 | E2E + 截图对比 NeoWOW |
| 滚轮/Space/中键平移缩放 | 已有 | 回归 |
| Ctrl+0 / F 适应视图 | 2.5.1 | 单测 + E2E |
| Ctrl+C/V 复制粘贴节点+连线 | 2.5.2 | 单测 + E2E |
| Ctrl+A 全选 | 2.5.2 | E2E |
| Shift 轴向约束 / L 网格吸附 | 2.5.3 | E2E |
| Handle 连线类型校验 | 2.5.5 | 单测 |
| 顶栏 + Run All | 2.6 + 2d.3 | E2E |
| 单节点运行 9 工具 | 2c–2d | integration + E2E |
| 图同步 API | 2b.3 | integration |

---

## 推荐执行顺序

```
Phase 0（取证） ─┐
                 ├→ Phase 2.5（基本操作）→ Phase 2.6（布局）
Phase 2b.3（API）┘         ↓
                    Phase 2c–2d（生成+轮询+Run All）
                              ↓
                         Phase 2e（Agent）
                              ↓
                         Phase 3（产品壳）
```

**首期 PR 建议（可独立合并）：**
1. `feature/neowow-canvas-guide` — 2.5.4 指南胶囊 + 2.6.1 顶栏
2. `feature/neowow-canvas-interaction` — 2.5.1–2.5.3 交互补齐
3. `feature/neowow-workflow-run` — 2b–2d 生成链路（含未提交改动）

---

## 工期预估（单人）

| Phase | 工期 |
|-------|------|
| 0 取证 | 0.5–1 天 |
| 2.5 基本操作 | 5–7 天 |
| 2.6 布局 | 2–3 天 |
| 2b–2d 生成链路 | 7–10 天（部分已开始） |
| 2e Agent | 3–4 天 |
| 3 产品壳 | 5–7 天 |
| **合计** | **约 4–5 周** |

---

## Self-Review

- [x] §0.1 每条指南能力可映射到 Task
- [x] 无 TBD 占位符
- [x] 文件路径与接口名一致
- [x] 与主计划 2026-07-09 无冲突，本计划为「基本操作」专项增量
