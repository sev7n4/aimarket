# P6 — 业务逻辑单源化与复杂度收敛

> **承接**：[STUDIO_REFACTOR_PLAN.md](./STUDIO_REFACTOR_PLAN.md) P0–P5（已全部完成 @ `515edd8`）  
> **目标**：消除提交路径重复、巨型 hook 技术债、Drama/UI 双轨维护成本；坚持**最小 diff、删优于加**。  
> **诊断依据**：2026-07-07 架构审视（提交六入口、`use-creation-panel` 2672 行、Drama 双轨卡片等）

---

## 进度总览

| 阶段 | 主题 | 状态 | 目标 PR |
|------|------|------|---------|
| **P6-0** | 死代码与 deprecated 清理 | ✅ 完成 | #301 |
| **P6-1** | 提交单源化 | ✅ 完成 | #302 / #307 |
| **P6-2** | `use-creation-panel` 拆分 | ✅ 完成 | #303–#305 |
| **P6-3** | 工具 UI meta 单源 | ✅ 完成 | #306 |
| **P6-4** | Drama 卡片 panel/node 统一 | 🔄 进行中 | scene PR |
| **P6-5** | `api-client` 按域拆分 | ⬜ 未开始 | — |

**P6 完成标准**

- 全产品仅 `dispatchCreationSubmit()` 一个执行入口（含路径决策）
- `use-creation-panel.tsx` <800 行
- 无零引用的 `@deprecated` 文件
- 工具 icon/label 由 `studio-tool-meta` 单源驱动

**P6 不做**

- API 视频 provider 大工厂
- Canvas 后端三模型协议统一
- 一次性拆掉 `studio-orchestration-provider`（982 行，需按功能切片）

---

## P6-0 — 死代码与 deprecated 清理

| ID | 任务 | 状态 | 产出 | 验证 |
|----|------|------|------|------|
| P6-0-1 | 删除 `WorkbenchPanel` | ✅ | 删 `workbench-panel.tsx` | 零 import；typecheck 绿 |
| P6-0-2 | 删除 `useCreationLaneState` | ✅ | 删 `use-creation-lane-state.ts` | 已由 `useCreationLaneDrafts` 替代 |
| P6-0-3 | 更新解耦文档 | ✅ | `CREATION_LANE_DECOUPLING.md` | 标注 hook 已移除 |
| P6-0-4 | 归档 P0–P5 进度 | ✅ | `STUDIO_REFACTOR_PLAN.md` 同步 | 行数表与 PR 表准确 |
| P6-0-5 | 死代码回归单测 | ✅ | `scripts/test-dead-code-removed.ts` | integration 绿 |

**P6-0 完成标准**：净删 ~290 行；CI 全绿；无行为变更。

---

## P6-1 — 提交单源化（最高 ROI）

| ID | 任务 | 状态 | 产出 | 验证 |
|----|------|------|------|------|
| P6-1-1 | 新建 `dispatchCreationSubmit()` | ✅ | `lib/creation-submit-dispatch.ts` | 合并 `runStudioSubmit` + creation-panel 分支 |
| P6-1-2 | 合并路径决策 | ✅ | `resolveCreationSubmitPathFromContext()` | 吸收 orchestration 布尔守卫 |
| P6-1-3 | UI 入口收敛 | ✅ | `useStudioSubmit` / `use-creation-panel` / `runStudioSubmit` | 均只调 dispatch |
| P6-1-4 | 删重复布尔守卫 | ✅ | `intent-router.ts` 精简 | `enhanceSubmitPath` 消费单源路径 |
| P6-1-5 | 单测扩展 | ✅ | `test-creation-lane-submit.ts` | intent 增强分支覆盖 |

**P6-1 完成标准**：`grep resolveCreationSubmitPath` 决策逻辑仅一处；预估净删 ~400 行。

---

## P6-2 — 拆分 `use-creation-panel`

| ID | 任务 | 状态 | 产出 | 验证 |
|----|------|------|------|------|
| P6-2-1 | `CreationPanelView.tsx` | ✅ | 纯 JSX 壳层 + overlays | dock / 首页 E2E |
| P6-2-2 | 上传 / @ 引用 hook | ✅ | `use-creation-panel-assets.ts` | 首页 + dock E2E |
| P6-2-3 | 提交逻辑 hook | ✅ | `use-creation-panel-submit.ts` | typecheck 绿 |
| P6-2-4 | Job 状态 / 灵感表单组件 | ✅ | `CreationPanelJobStatusBar` 等 | 纯展示拆分 |
| P6-2-5 | 润色逻辑 hook | ✅ | `use-creation-panel-polish.ts` | typecheck 绿 |

---

## P6-3 — 工具 UI meta 单源

| ID | 任务 | 状态 | 产出 | 验证 |
|----|------|------|------|------|
| P6-3-1 | 扩展 `studio-tool-meta.ts` | ✅ | `TOOL_SHORT_LABELS` + `studio-tool-icons` | 删 4 处重复映射表 |
| P6-3-2 | 收敛 toolbar 组件 | ✅ | selection-toolbar / batch-tool-strip 等 | 消费 meta 单源 |

---

## P6-4 — Drama 卡片统一

| ID | 任务 | 状态 | 产出 | 验证 |
|----|------|------|------|------|
| P6-4-1 | Scene 实体 shell | ✅ | `DramaSceneCardShell` + `mode: panel \| node` | panel + canvas E2E |
| P6-4-2 | Script 实体 shell | ✅ | `DramaScriptCardShell` + `mode: panel \| node` | typecheck 绿 |
| P6-4-2 | Script / Character / Shot | ⬜ | 同上模式 | drama E2E |

**不切**：`drama-studio-panel.tsx` 整体（964 行，另立后续阶段）。

---

## P6-5 — `api-client` 按域拆分

| ID | 任务 | 状态 | 产出 | 验证 |
|----|------|------|------|------|
| P6-5-1 | `lib/api/sessions.ts` 等 | ⬜ | 按 domain 搬家 | `api-client.ts` re-export 保持兼容 |
| P6-5-2 | 渐进迁移 import | ⬜ | 新代码直引子模块 | typecheck 绿 |

---

## PR 切分顺序（P6）

| PR | 包含任务 | 分支建议 | 合并状态 |
|----|----------|----------|----------|
| PR-17 | P6-0 死代码清理 | `chore/p6-dead-code-cleanup` | ✅ #301 |
| PR-18 | P6-1 提交单源化 | `enhancement/p6-submit-dispatch` | ✅ #302 |
| PR-19 | P6-2 creation-panel 拆分（1） | `enhancement/p6-creation-panel-view` | ✅ #303 |
| PR-20 | P6-2 上传/引用 hook | `enhancement/p6-creation-panel-upload` | ✅ #304 |
| PR-21 | P6-2 提交逻辑 hook | `enhancement/p6-creation-panel-submit` | ✅ #305 |
| PR-22 | P6-3 工具 meta 单源 | `enhancement/p6-tool-meta` | ✅ #306 |
| PR-23 | P6-1-4 intent-router 精简 | `enhancement/p6-intent-router-cleanup` | 🔄 进行中 |

---

## 架构目标（P6 后）

```
UI 触发（Dock / Home / Infinite / Focus edit）
    └── dispatchCreationSubmit(ctx)     ← P6-1 单入口
            ├── resolveSubmitPath()     ← 路径决策单源
            ├── orchestration → StudioOrchestrationProvider.dispatchSubmit
            ├── skill / agent / direct
            └── focus-edit（旁路，文档化）

CreationPanel
    └── use-creation-panel（薄组合 <100 行）
            ├── use-image-lane-form
            ├── use-video-lane-form
            └── CreationPanelView.tsx
```

---

## 变更日志

| 日期 | 变更 |
|------|------|
| 2026-07-07 | P6 计划起草；P6-0 开工 `chore/p6-dead-code-cleanup` |
