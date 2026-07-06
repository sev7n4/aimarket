# Studio 业务代码重构计划

> **目的**：拆掉 God 组件、统一提交 / 工具 / 菜单三条主线，贯彻最小化实现。  
> **维护**：开发过程中更新本文「进度」与「变更日志」；每个 PR 合并后勾选对应任务。  
> **关联**：[STUDIO_CANVAS_MODES.md](./STUDIO_CANVAS_MODES.md)（画布模式概念表）

---

## 进度总览

| 阶段 | 主题 | 状态 | 目标 PR |
|------|------|------|---------|
| **P0** | 安全网 + 概念收敛 | ✅ 完成 | PR-1 ~ PR-2 |
| **P1** | 提交主线统一 | ✅ 完成 | PR-3 ~ PR-4 |
| **P2** | 工具 / 菜单主线统一 | 🔄 进行中 | PR-5 ~ PR-7 |
| **P3** | 画布三 Pane 拆分 | ⬜ 未开始 | PR-8 ~ PR-11 |
| **P4** | 输入层拆分 + 组件去重 | ⬜ 未开始 | PR-12 ~ PR-13 |
| **P5** | workspace 瘦身 + 收尾 | ⬜ 未开始 | PR-14 |

**基线行数（main @ PR #290 后）**

| 文件 | 基线 | P3 目标 | P5 目标 |
|------|------|---------|---------|
| `creation-panel.tsx` | 2857 | 2857 | <400 |
| `studio-workspace.tsx` | 2299 | ~2000 | <1000 |
| `design-canvas.tsx` | 2197 | <500 | <400 |

---

## 原则与边界

1. **最小 diff**：每个 PR 一个可验证切片，避免 mega-refactor。
2. **行为不变优先**：先抽逻辑、后改 UI；每步有单测 / E2E。
3. **决策函数集中**：画布模式见 `lib/studio-canvas-view.ts`。
4. **副作用一处定义**：工具 handler、提交逻辑不在 workspace + canvas 重复。
5. **删优于加**：合并双实现；移除或实现 stub，禁止长期 `console.info` 占位。

**本轮不做**：API 视频 provider factory；canvas 三模型后端协议统一。

---

## P0 — 安全网与概念收敛

| ID | 任务 | 状态 | 产出 | 验证 |
|----|------|------|------|------|
| P0-1 | `buildInfiniteNodeToolbarActions` 单测 | ✅ | `scripts/test-infinite-node-toolbar-actions.ts` | integration 绿 |
| P0-2 | `useInfiniteNodeMenuHandlers` 单测 | ✅ | `scripts/test-infinite-node-menu-handlers.ts` | handler 非 stub 断言 |
| P0-3 | Infinite 概念文档 | ✅ | [STUDIO_CANVAS_MODES.md](./STUDIO_CANVAS_MODES.md) | 一页可读 |
| P0-4 | `isWorkflowInfinite` 命名/注释收敛 | ✅ | `resolveIsDramaWorkflowInfiniteView` | drama E2E 绿 |
| P0-5 | `mergeSnapshotToCanvasItems` integration | ✅ | `scripts/test-canvas-snapshot-sync.ts` | 防 #247 回归 |

**P0 完成标准**：新增测试 CI 绿；Infinite 概念文档就绪。

---

## P1 — 提交主线统一

| ID | 任务 | 状态 | 产出 | 验证 |
|----|------|------|------|------|
| P1-1 | 抽出 `useStudioSubmit()` | ✅ | `hooks/use-studio-submit.ts` | Scroll 生成 E2E |
| P1-2 | 抽出 `submitStudioGeneration()` 纯函数 | ✅ | `lib/studio-submit.ts` | `test-creation-lane-submit` |
| P1-3 | EmptyPrompt 直调 submit，删 `externalSubmitNonce` | ✅ | 删 nonce 相关 | `canvas-infinite-production` |
| P1-4 | Infinite 下 Dock `return null`，不 hidden 挂载 | ✅ | `studio-dock.tsx` | 空画布仍可提交 |
| P1-5 | Agent / 视频 / 电商提交回归 | ✅ | — | typecheck 绿 |

**P1 完成标准**：`externalSubmitNonce` 从 codebase 消失。

---

## P2 — 工具 / 菜单主线统一

| ID | 任务 | 状态 | 产出 | 验证 |
|----|------|------|------|------|
| P2-1 | 抽出 `useStudioToolHandlers()` | ✅ | `hooks/use-studio-tool-handlers.ts` | workspace ↓280 行 |
| P2-2 | 统一 `CanvasNodeHandlerContext` | ✅ | `lib/canvas-node-handlers.ts` | typecheck |
| P2-3 | `buildCanvasNodeActions()` 合并 Scroll + Infinite | ⬜ | 替换双 menu | 右键 E2E 各 1 |
| P2-4 | 工具链单入口 `buildCanvasNodeToolbarActions` | ⬜ | 合并 toolbar | 无重复 icon |
| P2-5 | 实现或删除 Drama stub handlers | ⬜ | 无 console.info | drama E2E |
| P2-6 | design-canvas 只收 factory props | ⬜ | 减 props | diff 以删为主 |

**P2 完成标准**：新增工具只改 1 个文件；菜单定义 1 处。

---

## P3 — 画布三 Pane 拆分

| ID | 任务 | 状态 | 产出 | 验证 |
|----|------|------|------|------|
| P3-1 | 共享 `CanvasPaneProps` | ⬜ | `canvas-pane-types.ts` | 无行为变更 |
| P3-2 | `InfiniteCanvasPane.tsx` | ⬜ | 从 design-canvas 迁出 | infinite E2E 绿 |
| P3-3 | `ScrollCanvasPane.tsx` | ⬜ | ProductGallery + 双栏 | canvas-batch E2E |
| P3-4 | `FreeCanvasPane.tsx` | ⬜ | refine / compare | focus-edit E2E |
| P3-5 | `DesignCanvas` 瘦身为路由 | ⬜ | <500 行 | 全 E2E 绿 |
| P3-6 | 合并 Orchestration overlay 三路径 | ⬜ | `OrchestrationOverlay` | drama production E2E |

**P3 完成标准**：`design-canvas.tsx` <500 行；三模式零交叉 import。

---

## P4 — 输入层拆分 + 组件去重

| ID | 任务 | 状态 | 产出 | 验证 |
|----|------|------|------|------|
| P4-1 | 拆分 Home / StudioDock CreationPanel | ⬜ | 共享 `useStudioSubmit` | 首页 + dock E2E |
| P4-2 | `creation-panel.tsx` <400 行 | ⬜ | re-export 或薄组合 | import 兼容 |
| P4-3 | 合并 MusicGenPanel 双实现 | ⬜ | variant prop | 音乐 toggle E2E |
| P4-4 | 合并 MultiCamGrid 双实现 | ⬜ | 同上 | 手动 / E2E |
| P4-5 | `creation-dock-controls` 按 lane 拆子模块 | ⬜ | 可选 | lint 绿 |

---

## P5 — workspace 瘦身与收尾

| ID | 任务 | 状态 | 产出 | 验证 |
|----|------|------|------|------|
| P5-1 | `studio-workspace.tsx` <1000 行 | ⬜ | 仅会话/Job/布局 | 全 CI 绿 |
| P5-2 | 可选 `StudioToolHandlersProvider` | ⬜ | Context 减 props | design-canvas props ↓50% |
| P5-3 | 更新 PR 模板检查项 | ⬜ | `.github` 或 PR_WORKFLOW | 新 PR 声明画布模式 |
| P5-4 | 生产复测清单 | ⬜ | `PROD_SMOKE_INFINITE.md` | 部署后 5 分钟 |

---

## PR 切分顺序

| PR | 包含任务 | 分支建议 | 合并状态 |
|----|----------|----------|----------|
| PR-1 | P0-1, P0-2, P0-5 | `enhancement/studio-refactor-p0` | ✅ #291 |
| PR-2 | P0-3, P0-4 | 同上 | ✅ #291 |
| PR-3 | P1-1, P1-2 | 同上 | ✅ #291 |
| PR-4 | P1-3, P1-4, P1-5 | 同上 | ✅ #291 |
| PR-5 | P2-1, P2-2 | `enhancement/studio-tool-handlers` | ⬜ |
| PR-6 | P2-3, P2-4 | `enhancement/studio-node-actions-unify` | ⬜ |
| PR-7 | P2-5, P2-6 | `enhancement/studio-drama-stubs` | ⬜ |
| PR-8 | P3-1, P3-2 | `enhancement/infinite-canvas-pane` | ⬜ |
| PR-9 | P3-3 | `enhancement/scroll-canvas-pane` | ⬜ |
| PR-10 | P3-4, P3-5 | `enhancement/design-canvas-router` | ⬜ |
| PR-11 | P3-6 | `enhancement/orchestration-overlay` | ⬜ |
| PR-12 | P4-1, P4-2 | `enhancement/creation-panel-split` | ⬜ |
| PR-13 | P4-3, P4-4 | `enhancement/component-dedup` | ⬜ |
| PR-14 | P5-* | `enhancement/studio-workspace-slim` | ⬜ |

---

## 每 PR 验证清单

```markdown
- [ ] pnpm typecheck
- [ ] pnpm test:integration（动 API/提交/画布时）
- [ ] E2E 最小集：smoke + canvas-infinite-production + canvas-node-crud + drama-canvas-e2e
- [ ] CI 全绿（lint-typecheck / docker-build / Integration / E2E）
- [ ] PR description 自报受影响行数
- [ ] 合并 main 部署后：PROD_SMOKE_INFINITE（仅 Infinite/画布 PR）
```

---

## 变更日志

| 日期 | 变更 |
|------|------|
| 2026-07-06 | 初版计划；P0 开工分支 `enhancement/studio-refactor-p0` |
| 2026-07-06 | PR #291 合并 `f73d089`；部署成功；API/Web health 200 |

---

## 架构终态（参考）

```
studio-workspace（壳）
  ├── useStudioSubmit / useStudioToolHandlers
  ├── StudioOrchestrationProvider
  └── DesignCanvas（薄路由）
        ├── InfiniteCanvasPane
        ├── ScrollCanvasPane
        └── FreeCanvasPane
              └── buildCanvasNodeActions / buildCanvasNodeToolbarActions
```
