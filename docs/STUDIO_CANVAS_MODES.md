# Studio 画布模式概念表

> 与 [STUDIO_REFACTOR_PLAN.md](./STUDIO_REFACTOR_PLAN.md) P0-3 配套。新增 Infinite/Scroll 相关逻辑前请先对照本表。

---

## 决策函数（单一真相）

| 函数 | 文件 | 职责 |
|------|------|------|
| `resolveUseInfiniteCanvas(input)` | `apps/web/src/lib/studio-canvas-view.ts` | **是否渲染 Infinite 引擎** |
| `resolveDramaPhaseSplitEnabled(...)` | 同上 | Infinite 下是否叠加短剧节点面板 |
| `resolveCanvasViewToggleEnabled(...)` | 同上 | 「节点视图」切换按钮是否可用 |

**规则摘要**：

- 默认 **ScrollCanvas**（`viewPhase === "agent"`）。
- 用户切 **节点视图**（`viewPhase === "workflow"`）且 `canvasFlowEnabled` → **InfiniteCanvas**。
- `canvasFlowEnabled === false` 或 **短剧规划中** → 强制 Scroll。

单测：`pnpm exec tsx scripts/test-studio-canvas-view.ts`

---

## 运行时符号对照（易混淆）

| 符号 | 定义位置 | 含义 | 影响 UI |
|------|----------|------|---------|
| `useInfiniteCanvas` | `DesignCanvas` prop | 传入的「当前是否 Infinite 引擎」 | 渲染 Infinite vs Scroll/Free 分支 |
| `infiniteCanvasActive` | `studio-workspace` state | `onInfiniteCanvasActiveChange(useInfiniteCanvas)` | **隐藏全局 StudioDock**、scroll inset、overlay inset |
| `resolveIsDramaWorkflowInfiniteView(...)` | `studio-canvas-view.ts` | Infinite + phase split + workflow 视图 | 侧栏 Drama/Assistant、orchestration dock |
| ~~`isWorkflowInfinite`~~ | 已收敛为 ↑ | 同上 | — |
| `viewPhase` | `DramaStudioViewPhase` | `"agent"` \| `"workflow"` | 用户显式 Scroll vs 节点视图 |

---

## 副作用映射表

| 用户操作 / 状态 | 引擎 | 全局 Dock | 节点创作台 | 空画布入口 |
|-----------------|------|-----------|------------|------------|
| 默认进入 Studio | Scroll | 显示 | 无 | 无（用 Dock） |
| 切「节点视图」 | Infinite | **隐藏** | 选中单节点时显示 | 无节点时 `InfiniteCanvasEmptyPrompt` |
| 短剧规划进行中 | Scroll（强制） | 显示 | — | — |
| Agent + 制片 + workflow Infinite | Infinite + 短剧面板 | 隐藏 | 选中节点 + 可选 overlay | 同 Infinite |

---

## 数据模型（跨端）

| 层 | 表示 | 位置 |
|----|------|------|
| Scroll 持久化 | `CanvasItem[]` layout | API `canvas-layout` |
| Flow 图 | nodes + edges | API `canvas-flow-store` + bridge |
| Infinite 运行时 | `CanvasNodeData[]` | Web `infinite-canvas/types` + `sync-infinite-snapshot` |

重构 P0-5 已完成：`mergeSnapshotToCanvasItems` integration 见 `scripts/test-canvas-snapshot-sync.ts`。

---

## 相关 E2E

| 场景 | spec |
|------|------|
| Infinite 生产路径 | `e2e/canvas-infinite-production.spec.ts` |
| 节点 CRUD | `e2e/canvas-node-crud.spec.ts` |
| Drama Infinite | `e2e/drama-canvas-e2e.spec.ts` |
| 画布模式决策 | `scripts/test-studio-canvas-view.ts` |
| 工具链去重 | `scripts/test-infinite-node-toolbar-actions.ts` |
| menu handler 路由 | `scripts/test-infinite-node-menu-handlers.ts` |
| 快照 ↔ layout 同步 | `scripts/test-canvas-snapshot-sync.ts` |
