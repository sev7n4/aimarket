# Canvas 减法整合开发计划

> **目的**：下线 Workflow / Drama / Production / FreeCanvas 产品线，收敛为「左轨 + → `/studio` → ScrollCanvas + 对话 Dock」单入口单引擎模型。  
> **维护**：每个 PR 合并后更新「进度总览」「任务表状态」与文末「变更日志」。Review 时对照 [Checklist](#完整-checklist) 逐项勾选。  
> **关联**：[STUDIO_CANVAS_MODES.md](./STUDIO_CANVAS_MODES.md)（终态后需重写）、[STUDIO_REFACTOR_PLAN.md](./STUDIO_REFACTOR_PLAN.md)

| 元信息 | 值 |
|--------|-----|
| 状态 | 🟡 待开发 |
| 创建日期 | 2026-07-14 |
| 预估工期 | 3–4 周（4 个 Phase，Phase E 可选） |
| 预估删码 | ~18,000–23,000 行 |
| 分支前缀 | `enhancement/canvas-subtraction` |

---

## 终态目标

```
用户 → 左轨 [+] → /studio → ScrollCanvas（ProductGallery）+ CreationDock
```

| 维度 | 终态 |
|------|------|
| 创作入口 | 仅左轨 `+` |
| 路由 | 仅 `/studio` 可新建；`/workflow`、`/workflows` 301 → `/studio` |
| 引擎 | 仅 ScrollCanvas 挂载；Infinite 代码 Phase E 决定去留 |
| 数据写源 | 仅 `canvas_layout` |
| CreationMode | 仅 `image` \| `chat` |

---

## 进度总览

| Phase | 主题 | 状态 | 目标分支 / PR | 预估 |
|-------|------|------|---------------|------|
| **A** | 入口清零 | ✅ 完成 | `enhancement/canvas-subtraction-a` | 2–3 天 |
| **B** | Workflow 产品线下线 | ✅ 完成 | `enhancement/canvas-subtraction-b` | 3–5 天 |
| **C** | Drama/Production 产品线下线 | ✅ 完成 | `enhancement/canvas-subtraction-c` | 5–7 天 |
| **D** | 引擎与数据收尾 | ✅ 完成 | `enhancement/canvas-subtraction-d` | 3–5 天 |
| **E** | Infinite 引擎去留（可选） | ✅ 完成 | `enhancement/canvas-subtraction-e` | 2–3 天 |

**Phase 完成标准（全局）**

- [ ] `pnpm typecheck` 零错误
- [ ] `pnpm test:integration` 全绿
- [ ] 相关 E2E 更新后全绿
- [ ] 无新增 `console.info` stub
- [ ] 对应任务表全部 ✅

---

## 原则与边界

### 开发纪律

1. **一个 PR 一个 Phase 切片**（A→B→C→D 顺序依赖，不可跳 Phase）。
2. **删优于留**：废弃代码直接删除，禁止 `// TODO remove` 长期占位。
3. **行为先测后删**：删 E2E 前先确认无回归需求；必要处补「入口不存在」断言。
4. **禁止直推 main**；Squash merge；CI + Integration + E2E 全绿再合并。
5. **本地验证**：每 PR 合并前 `pnpm typecheck` + `pnpm test:integration`。

### 本轮不做

- Scroll 引擎替换为 Infinite preset（留 Phase E 决策）
- API 视频 provider factory 重构
- 移动端专项改造
- `/projects` 页面下线（保留，链接改 `/studio`）

### 分支命名

```
enhancement/canvas-subtraction-a   # Phase A
enhancement/canvas-subtraction-b   # Phase B
...
```

---

## Phase A — 入口清零

> **目标**：全站仅左轨 `+` 可新建画布；废弃路由 301；删除节点视图切换。

### 任务表

| ID | 任务 | 状态 | 涉及文件 | 验证 |
|----|------|------|----------|------|
| A-1 | 删除 `HomeProductionEntry` 组件 | ✅ | `apps/web/src/components/home-production-entry.tsx` | 文件不存在 |
| A-2 | 首页移除三按钮引用 | ✅ | `apps/web/src/components/home-creation-section.tsx` | 首页无「自由画布/开始制片/电商套图」 |
| A-3 | 删除左轨「工作流」图标 | ✅ | `apps/web/src/components/app-left-rail.tsx` L245–254 | `nav-workflows` testId 不存在 |
| A-4 | `/workflows` 路由删除 + 301 | ✅ | `apps/web/next.config.ts` redirects | GET `/workflows` → 301 `/studio` |
| A-5 | `/workflow` 路由删除 + 301 | ✅ | `apps/web/next.config.ts` redirects | GET `/workflow` → 301 `/studio` |
| A-6 | 删除节点视图 toggle UI | ✅ | `apps/web/src/components/canvas-panes/DesignCanvasChrome.tsx` | `drama-view-phase-toggle` 不存在 |
| A-7 | 删除 `viewPhase` 用户态 | ✅ | `apps/web/src/components/studio-canvas-with-orchestration.tsx` | 无 `manualViewPhase` state |
| A-8 | 清理 `studio-navigation.ts` | ✅ | `apps/web/src/lib/studio-navigation.ts` | 仅保留 `buildStudioUrl` / `studioUrlForSession` |
| A-9 | 清理 `inspiration-studio.ts` 制片深链 | ✅ | `apps/web/src/lib/inspiration-studio.ts` | 无 `buildProductionStudioUrl` 引用 |
| A-10 | 更新 E2E helper | ✅ | `apps/web/e2e/helpers/studio.ts` | 删除 toggle / workflow helper |
| A-11 | 删除/更新入口 E2E | ✅ | 删除废弃 spec；新增 `deprecated-routes.spec.ts` | — |
| A-12 | `mode=production` URL 重定向 | ✅ | `apps/web/src/app/studio/studio-page-client.tsx` | `/studio?mode=production` → `mode=image` |

### Phase A 完成标准

- [ ] 全站搜索 `buildWorkflowUrl` / `buildProductionStudioUrl` / `HomeProductionEntry` 零引用
- [ ] 全站搜索 `drama-view-phase-toggle` 零引用
- [ ] `pnpm typecheck` 绿
- [ ] 冒烟 E2E 绿

---

## Phase B — Workflow 产品线下线

> **目标**：删除 Workflow 壳层、工具节点、Agent 面板、相关 API 与 E2E。

### 任务表

| ID | 任务 | 状态 | 涉及文件 | 验证 |
|----|------|------|----------|------|
| B-1 | 删除 `components/workflows/*` | ✅ | `WorkflowTopBar`, `WorkflowCard`, `CreateWorkflowButton`, `WorkflowLeftPanel`, `WorkflowToolPalette`, `WorkflowToolNodeContent` | 目录不存在 |
| B-2 | 删除 workflow lib | ✅ | `workflow-shell.ts`, `workflow-tool-run.ts`, `workflow-graph-sync.ts`, `workflow-generation-poller.ts`, `workflow-template-apply.ts` | 零引用 |
| B-3 | 删除 workflow API client | ✅ | `lib/api/workflow-agent.ts`, `lib/api/workflow-templates.ts`, `lib/api/story-canvas*.ts` | 零引用 |
| B-4 | 删除 `workflowShell` prop 链 | ✅ | `studio-workspace.tsx`, `studio-workspace-types.ts`, `studio-canvas-with-orchestration.tsx`, `design-canvas-types.ts` | 无 `workflowShell` 符号 |
| B-5 | 删除 Infinite Workflow Agent 面板 | ✅ | `infinite-canvas/agent/*` | 目录不存在 |
| B-6 | 清理 `InfiniteCanvasPane` workflow 分支 | ✅ | `canvas-panes/InfiniteCanvasPane.tsx` | 无 `WorkflowLeftPanel` 引用 |
| B-7 | 清理 `CanvasNode` 工具节点 | ✅ | `infinite-canvas/CanvasNode.tsx` | 无 `WorkflowToolNodeContent` |
| B-8 | 删除 API `workflow-agent` 路由 | ✅ | `apps/api/src/routes/workflow-agent.ts`, `apps/api/src/index.ts` | 路由不存在 |
| B-9 | 删除 API `workflow-templates` 路由 | ✅ | `apps/api/src/routes/workflow-templates.ts` | 路由不存在 |
| B-10 | 删除 API `story-canvas` 路由 | ✅ | `apps/api/src/routes/story-canvas.ts`, `story-canvas-share.ts` | 路由不存在 |
| B-11 | 删除 workflow 单测脚本 | ✅ | `scripts/test-workflow-*.ts` | 文件不存在 |
| B-12 | 删除 workflow E2E | ✅ | `e2e/workflow-*.spec.ts`, `e2e/workflows-list.spec.ts` | 文件不存在 |
| B-13 | 清理 `TemplateManager` workflow 引用 | ✅ | `infinite-canvas/TemplateManager.tsx` | 无 workflow 模板逻辑或整文件删除 |

### Phase B 完成标准

- [ ] 全站搜索 `workflowShell` / `WorkflowTopBar` / `story-canvas` 零引用（除 migration 注释）
- [ ] API 启动无 workflow/story-canvas 路由注册
- [ ] `pnpm test:integration` 绿
- [ ] 删改相关 integration test

---

## Phase C — Drama/Production 产品线下线

> **目标**：删除短剧/制片前后端全模块；CreationMode 收敛；编排层扁平化。

### 任务表

| ID | 任务 | 状态 | 涉及文件 | 验证 |
|----|------|------|----------|------|
| C-1 | 删除 Web `drama-*.tsx` 组件 | ✅ | `components/drama-*.tsx`, `components/drama/**`（~30 文件） | 目录不存在 |
| C-2 | 删除 `infinite-canvas/drama/*` | ✅ | `ScriptNodeContent`, `ShotNodeContent`, `CharacterNodeContent`, `SceneNodeContent`, `DramaPropertyPanel`, `drama-plan-to-nodes.ts`, `drama-canvas-mutations.ts` 等 | 目录不存在 |
| C-3 | 删除 drama hooks | ✅ | `hooks/use-drama-plan.ts`, `hooks/use-drama-run.ts` | 零引用 |
| C-4 | 删除 drama lib | ✅ | `lib/api/drama.ts`, `lib/drama-*.ts` | 零引用 |
| C-5 | 删除 `studio-orchestration-provider.tsx` | ✅ | 整体删除或替换为空壳 Provider | Drama 零引用 |
| C-6 | 删除 `studio-canvas-with-orchestration.tsx` | ✅ | 逻辑并入 `design-canvas.tsx` 或 `studio-workspace.tsx` | 文件不存在 |
| C-7 | 删除 `alternateCanvasContent` prop 链 | ✅ | `design-canvas-types.ts`, `DesignCanvasView.tsx`, `InfiniteCanvasPane.tsx`, `canvas-pane-types.ts` | 符号不存在 |
| C-8 | 删除 `scroll-canvas-orchestration-card.tsx` drama 分支 | ✅ | 保留 Agent/Skill 时间线简化版 | 无 drama 分支 |
| C-9 | 删除 `OrchestrationOverlay.tsx` drama 分支 | ✅ | 保留 Agent/Skill 编排 footer | 无 drama 分支 |
| C-10 | 删除 API `drama` 路由 | ✅ | `apps/api/src/routes/drama.ts`, `apps/api/src/index.ts` | 路由不存在 |
| C-11 | 删除 API `lib/drama/*` | ✅ | planner, runs, replicate, schema 等 | 目录不存在 |
| C-12 | 删除 API `providers/drama/*` | ✅ | TTS, ffmpeg 等 | 目录不存在 |
| C-13 | CreationMode 收敛 | ✅ | `packages/ui`, `use-creation-panel.tsx`, `studio-workspace.tsx`, `modes.ts` | 仅 `image` \| `chat`；`production` / `ecommerce` 编译报错或重定向 |
| C-14 | 清理 Dock 制片/电商参数 | ✅ | `creation-dock-controls/*`, `drama-*-dock-params.tsx` | 无 drama/production UI |
| C-15 | 清理 `studio-canvas-view.ts` drama 函数 | ✅ | 删除 `resolveDramaPhaseSplitEnabled`, `resolveIsDramaWorkflowInfiniteView` | 仅留 `resolveUseInfiniteCanvas`（Phase C 固定 scroll） |
| C-16 | 删除 drama 单测脚本 | ✅ | `scripts/test-drama-*.ts`, `scripts/test-open-api-drama.ts` | 文件不存在 |
| C-17 | 删除 drama E2E | ✅ | `e2e/drama-*.spec.ts`, `e2e/production-*.spec.ts`, `e2e/helpers/drama-production.ts` | 文件不存在 |
| C-18 | 存量 Drama session 归档 | ✅ | `scripts/migrate-archive-drama-sessions.ts`（新建） | 脚本可 dry-run；`mode=production` session 标记 `archived` |
| C-19 | 更新 `intent-router.ts` | ✅ | 移除 production/ecommerce 意图路由 | 无 drama 意图 |

### Phase C 完成标准

- [x] 全站搜索 `drama` / `Drama` / `production`（组件级）零引用（除 archive 脚本、变更日志、legacy 占位）
- [x] `mode=production` / `mode=ecommerce` URL 重定向到 `mode=image`
- [x] `studio-canvas-with-orchestration.tsx` 不存在
- [ ] `pnpm test:integration` 绿（待 PR CI）

---

## Phase D — 引擎与数据收尾

> **目标**：删除 FreeCanvas；固定 Scroll 引擎；单写源 `canvas_layout`；文档更新。

### 任务表

| ID | 任务 | 状态 | 涉及文件 | 验证 |
|----|------|------|----------|------|
| D-1 | 删除 `free-canvas.tsx` | ✅ | ~1300 行 | 文件不存在 |
| D-2 | 删除 `FreeCanvasPane.tsx` | ✅ | | 文件不存在 |
| D-3 | 删除 refine 模式分支 | ✅ | `use-design-canvas.tsx`, `DesignCanvasView.tsx`, `DesignCanvasChrome.tsx` | 无 `isRefineMode` / `showFreeCanvas` |
| D-4 | 清理 lightbox 精修入口 | ✅ | `canvas-lightbox.tsx` | 无「进入自由画布精修」 |
| D-5 | `resolveCanvasEngine()` 固定 `"scroll"` | ✅ | `lib/studio-canvas-view.ts` | 函数 ≤15 行；单测更新 |
| D-6 | 删除 `DesignCanvasView` Infinite/Free 分支 | ✅ | 仅渲染 `ScrollCanvasPane` | 无 `InfiniteCanvasPane` / `FreeCanvasPane` import |
| D-7 | 删除 `InfiniteCanvasPane.tsx`（若不挂载） | ✅ | 与 Phase E 联动 | 保留文件、DesignCanvasView 不引用 |
| D-8 | Web 停止写 `canvas_flow` | ✅ | `use-session-canvas.ts`, `lib/api/canvas.ts` | 无 PUT `canvas-flow` |
| D-9 | API `canvas_flow` 标记 deprecated | ✅ | `apps/api/src/routes/sessions.ts`, `db` migration | 写接口返回 410 或忽略 |
| D-10 | 存量 workflow session 迁移 | ✅ | `scripts/migrate-workflow-sessions-to-studio.ts`（新建） | dry-run 通过；layout 数据完整 |
| D-11 | 更新 `STUDIO_CANVAS_MODES.md` | ✅ | 重写为单引擎模型 | 文档与代码一致 |
| D-12 | 更新 `.trae/specs/infinite-canvas-integration/` | ✅ | 标记 spec 归档 | — |
| D-13 | 更新 `scripts/test-studio-canvas-view.ts` | ✅ | 仅测 `resolveCanvasEngine` | 单测绿 |
| D-14 | 更新剩余 E2E | ✅ | `canvas-infinite-production.spec.ts`, `canvas-node-crud.spec.ts`, `drama-canvas-e2e.spec.ts` | 删除或改为 scroll-only 断言 |
| D-15 | `studio-workspace.tsx` 瘦身 | ✅ | 删除 `infiniteCanvasActive`、workflow 残留 | 行数下降 |

### Phase D 完成标准

- [ ] 全站搜索 `FreeCanvas` / `isRefineMode` / `canvas-flow` PUT 零引用
- [ ] Studio 仅渲染 ScrollCanvas
- [ ] `pnpm typecheck` + `pnpm test:integration` + E2E 全绿
- [ ] `STUDIO_CANVAS_MODES.md` 已更新

---

## Phase E — Infinite 引擎去留（可选，Phase D 后决策）

> **决策点**：Phase D 完成后 review，二选一。

| 选项 | 动作 | 删码 |
|------|------|------|
| **E1 删除（推荐）** | 删除 `infinite-canvas/` 目录（~42 文件）、相关单测、圈选/扩图 Web UI | ~5,000 行 |
| **E2 维持不挂载** | 保留代码，无路由引用；每季度评估 | 0 |

> **决策（2026-07-16）**：采用 **E1 删除**。

### E1 任务表（若选删除）

| ID | 任务 | 状态 | 涉及文件 | 验证 |
|----|------|------|----------|------|
| E-1 | 删除 `components/infinite-canvas/*` | ✅ | 整个目录 | 目录不存在 |
| E-2 | 删除 canvas 节点单测 | ✅ | `scripts/test-infinite-*.ts`, `scripts/test-canvas-snapshot-sync.ts` 等 | 文件不存在 |
| E-3 | 清理 `canvas-layout.ts` infinite 字段 | ✅ | `infiniteConnections`, `dramaNodePositions` 标记 deprecated | API 仍向后兼容读取 |
| E-4 | 删除 `canvas-node-*.ts` 工具链 | ✅ | Infinite 专用 lib/hooks 删除；Scroll 右键菜单简化 | 零 infinite 引用 |
| E-5 | 下线圈选/扩图 Web UI | ✅ | `expand-frame-overlay`, `mask-brush`, `use-mask-brush` 等 | 工具条不展示 expand/inpaint/erase |

---

## 存量数据迁移

### 脚本清单

| 脚本 | Phase | 用途 |
|------|-------|------|
| `scripts/migrate-archive-drama-sessions.ts` | C | `mode=production` session → `archived=true`，保留产物只读 |
| `scripts/migrate-workflow-sessions-to-studio.ts` | D | workflow session → `shell=studio`，合并 layout |
| `scripts/migrate-canvas-flow-to-layout.ts` | D | 一次性 `canvas_flow` → `canvas_layout` |

### 迁移要求

- 所有脚本支持 `--dry-run`
- 输出迁移计数日志
- 迁移前备份 DB（生产环境）

---

## 验收标准（最终上线）

### 功能

- [ ] 左轨 `+` 新建 → `/studio` → ScrollCanvas 正常渲染
- [ ] 左轨「最近」→ 打开历史 session 正常
- [ ] `/projects` 链接指向 `/studio`
- [ ] `/workflow`、`/workflows` 返回 301 到 `/studio`
- [ ] `/studio?mode=production` 重定向到 `mode=image`
- [ ] 首页无「自由画布 / 开始制片 / 电商套图」
- [ ] Studio 内无「节点视图」按钮
- [ ] 无 FreeCanvas / 精修模式入口

### 技术

- [ ] `pnpm typecheck` 零错误
- [ ] `pnpm test:integration` 全绿
- [ ] E2E 套件全绿（已删废弃 spec）
- [ ] 无废弃路由注册（API 层）
- [ ] 无 `canvas_flow` 写操作

### 文档

- [ ] `STUDIO_CANVAS_MODES.md` 反映单引擎模型
- [ ] 本文档进度总览全部 ✅
- [ ] `PRODUCT.md` / `PRD.md` 移除 Workflow/Drama/Production 产品描述（或标注已下线）

---

## 完整 Checklist

> Review 时复制下表到 PR 描述，或逐项勾选。

### Phase A — 入口清零

- [x] A-1 删除 `home-production-entry.tsx`
- [x] A-2 首页移除三按钮
- [x] A-3 删除左轨「工作流」图标
- [x] A-4 `/workflows` 301
- [x] A-5 `/workflow` 301
- [x] A-6 删除节点视图 toggle
- [x] A-7 删除 `viewPhase` 状态
- [x] A-8 清理 `studio-navigation.ts`
- [x] A-9 清理 `inspiration-studio.ts` 制片深链
- [x] A-10 更新 E2E helper
- [x] A-11 删除/更新入口 E2E
- [x] A-12 `mode=production` 重定向
- [x] **Phase A 验证**：typecheck 绿

### Phase B — Workflow 下线

- [x] B-1 删除 `components/workflows/*`
- [x] B-2 删除 workflow lib
- [x] B-3 删除 workflow API client
- [x] B-4 删除 `workflowShell` prop 链
- [x] B-5 删除 `infinite-canvas/agent/*`
- [x] B-6 清理 `InfiniteCanvasPane`
- [x] B-7 清理 `CanvasNode` 工具节点
- [x] B-8 删除 API `workflow-agent`
- [x] B-9 删除 API `workflow-templates`
- [x] B-10 删除 API `story-canvas`
- [x] B-11 删除 workflow 单测脚本
- [x] B-12 删除 workflow E2E
- [x] B-13 清理 `TemplateManager`
- [x] **Phase B 验证**：typecheck 绿

### Phase C — Drama/Production 下线

- [x] C-1 删除 Web drama 组件
- [x] C-2 删除 `infinite-canvas/drama/*`
- [x] C-3 删除 drama hooks
- [x] C-4 删除 drama lib
- [x] C-5 删除/替换 orchestration provider
- [x] C-6 删除 `studio-canvas-with-orchestration.tsx`
- [x] C-7 删除 `alternateCanvasContent`
- [x] C-8 删除 `scroll-canvas-orchestration-card.tsx` drama 分支
- [x] C-9 删除 `OrchestrationOverlay.tsx` drama 分支
- [x] C-10 删除 API `drama` 路由
- [x] C-11 删除 API `lib/drama/*`
- [x] C-12 删除 API `providers/drama/*`
- [x] C-13 CreationMode 收敛
- [x] C-14 清理 Dock 制片/电商参数
- [x] C-15 清理 `studio-canvas-view.ts`
- [x] C-16 删除 drama 单测脚本
- [x] C-17 删除 drama E2E
- [x] C-18 存量 Drama session 归档脚本
- [x] C-19 更新 `intent-router.ts`
- [x] **Phase C 验证**：typecheck 绿；`test-studio-canvas-view` + `test-canvas-connection-ux` 绿

### Phase D — 引擎与数据收尾

- [x] D-1 删除 `free-canvas.tsx`
- [x] D-2 删除 `FreeCanvasPane.tsx`
- [x] D-3 删除 refine 模式分支
- [x] D-4 清理 lightbox 精修入口
- [x] D-5 `resolveCanvasEngine()` 固定 scroll
- [x] D-6 `DesignCanvasView` 仅 Scroll 分支
- [x] D-7 保留 `InfiniteCanvasPane`（未挂载）
- [x] D-8 Web 停止写 `canvas_flow`
- [x] D-9 API `canvas_flow` deprecated
- [x] D-10 存量 workflow session 迁移脚本
- [x] D-11 更新 `STUDIO_CANVAS_MODES.md`
- [x] D-12 归档 infinite-canvas spec
- [x] D-13 更新 `test-studio-canvas-view.ts`
- [x] D-14 更新剩余 E2E
- [x] D-15 `studio-workspace.tsx` 瘦身
- [x] **Phase D 验证**：typecheck 绿

### Phase E — Infinite 去留（可选）

- [x] E0 Phase D 后 Review 决策 E1 / E2 → **E1**
- [x] E-1 删除 `infinite-canvas/`
- [x] E-2 删除相关单测
- [x] E-3 清理 layout infinite 字段（deprecated 读-only）
- [x] E-4 清理 canvas-node 工具链
- [x] E-5 下线圈选/扩图 Web UI
- [x] **Phase E 验证**：typecheck 绿；`test-studio-canvas-view` + `test-dead-code-removed` 绿

### 最终上线

- [ ] 全部 Phase 完成标准满足
- [ ] 存量迁移脚本生产执行
- [ ] `PRODUCT.md` / `PRD.md` 更新
- [ ] Deploy 后冒烟通过

---

## PR 切片建议

| PR | 分支 | 包含任务 | 标题建议 |
|----|------|----------|----------|
| PR-1 | `enhancement/canvas-subtraction-a` | A-1 ~ A-12 | `chore(canvas): remove scattered entry points and deprecated routes` |
| PR-2 | `enhancement/canvas-subtraction-b` | B-1 ~ B-13 | `chore(canvas): remove workflow product line` |
| PR-3 | `enhancement/canvas-subtraction-c` | C-1 ~ C-19 | `chore(canvas): remove drama and production product line` |
| PR-4 | `enhancement/canvas-subtraction-d` | D-1 ~ D-15 | `chore(canvas): finalize scroll-only engine and data model` |
| PR-5 | `enhancement/canvas-subtraction-e` | E-1 ~ E-4 | `chore(canvas): remove infinite canvas engine`（可选） |

每个 PR 描述模板：

```markdown
## Summary
- Phase X of Canvas Subtraction Plan（docs/CANVAS_SUBTRACTION_PLAN.md）

## Checklist
- [ ] 对应 Phase 任务全部完成
- [ ] pnpm typecheck
- [ ] pnpm test:integration
- [ ] E2E 更新

## Test plan
- [ ] 左轨 + 新建 studio 正常
- [ ] 废弃路由 301 正常
- [ ] ...
```

---

## 变更日志

| 日期 | PR | 内容 |
|------|-----|------|
| 2026-07-14 | — | 创建计划文档；方案评审通过 |
| 2026-07-16 | enhancement/canvas-subtraction-d | Phase D 引擎与数据收尾：Scroll-only、FreeCanvas 删除、canvas_flow 写废弃 |
| 2026-07-16 | enhancement/canvas-subtraction-e | Phase E：删除 Infinite 引擎；下线圈选/扩图 Web UI |

---

## Review 指引

### 每个 PR Review 重点

| Phase | 关注点 |
|-------|--------|
| A | 无遗漏入口；301 正确；首页/左轨 UI 干净 |
| B | 无 workflow 符号残留；API 路由已注销；E2E 已删 |
| C | drama 组件/API 完全移除；CreationMode 收敛；orchestration 层已扁平 |
| D | 仅 Scroll 挂载；FreeCanvas 已删；单写源；文档同步 |
| E | infinite-canvas 删除彻底；layout 向后兼容 |

### 禁止事项

- ❌ 直推 main
- ❌ 跳过 integration 验证
- ❌ 保留废弃代码「以后再用」
- ❌ 单个 PR 跨多个 Phase
