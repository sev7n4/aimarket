# NeoWOW 工作流工具节点 — Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** 在 `/workflow` 壳内引入 NeoWOW 式工具节点注册表与左栏调色板，用户可一键添加文生图/视频/扩图等工具节点。

**Architecture:** `workflow-tool-registry.ts` 定义工具元数据；`WorkflowToolPalette` 渲染分类列表；`handleAddWorkflowTool` 通过 `CanvasAgentOp` 在视口中心落点创建节点，metadata 携带 `workflowToolType`。

**Tech Stack:** TypeScript, InfiniteCanvas, CanvasAgentOp

## Global Constraints

- 分支：`feature/neowow-workflows-list`
- TDD：registry 单测 + E2E palette smoke
- Phase 2 仅落节点创建，生成 API 对接留 Phase 2b

---

## Phase 2a（本次）— 已完成

- [x] `workflow-tool-registry.ts` — 9 个高频工具
- [x] `WorkflowToolPalette.tsx` — 分类左栏
- [x] `InfiniteCanvasPane` workflowShell 集成
- [x] `handleAddWorkflowTool` in use-design-canvas
- [x] `scripts/test-workflow-tool-registry.ts`
- [x] E2E：workflow-agent 校验 palette

## Phase 2b（下一步）

- [ ] 连线语义：上游 `connectedImageUrls` 自动注入
- [ ] 节点工具栏：按 `workflowToolType` 触发 `/api/v1/tools/{id}/run`
- [ ] 异步状态轮询（对标 NeoWOW `batch-query-status`）
- [ ] 补充 LIP_SYNC、POSE_REFERENCE、MOTION_CONTROL 工具

## Phase 3+

见 `2026-07-09-neowow-parity-phase1.md` 后续章节
