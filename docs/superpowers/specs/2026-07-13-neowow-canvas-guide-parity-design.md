# NeoWOW 画布使用指南能力对标 — 设计规格

> 日期：2026-07-13  
> 状态：待评审  
> 取证来源：NeoWOW「画布使用指南」截图（用户提供，2026-07-13）  
> 关联：`docs/superpowers/plans/2026-07-10-neowow-canvas-basic-operations.md`（Phase 2.5 部分已完成）

## 1. 背景与目标

AIMarket workflow 无限画布已具备选中/拖拽/连线/fitView/复制粘贴/指南胶囊等基础能力，但与 NeoWOW「画布使用指南」截图对照后仍有系统性缺口。本规格将缺口固化为 **C1–C4 四期**，按序交付，使 workflow 壳交互达到截图所列能力。

**目标：** 用户在 `/workflow` 壳内可完成截图中的基础操作、画布导航、高级功能（含 Run All / 资产面板），且左下「使用指南」文案与真实行为一致。

**非目标：**

- 迁移到 React Flow / Vue Flow
- PlayCanvas 3D World
- 完整 25+ 工具全量补齐（工具生成链路另见主计划）
- 白标多租户

## 2. 取证能力清单（验收原文）

### 2.1 基础操作

| ID | 能力 | AIMarket 现状 | 目标行为 |
|----|------|---------------|----------|
| B1 | 添加节点 | ✅ 右键/双击空白菜单 | 保持 |
| B2 | 连接节点 | ✅ 右→左 handle | 保持 |
| B3 | 连线生成节点 | △ 仅输出点「+」 | 从输出点拖到空白 → 弹出创建菜单 → 创建后自动连线 |
| B4 | 选中与移动 | ✅ | 保持 |
| B5 | 重命名节点 | ❌ | 双击节点标题 → inline 编辑 `node.title` |
| B6 | 编辑连线 | △ 可高亮，无剪刀 | 单击选中连线 → 中点显示剪刀 → 点击删除 |
| B7 | 删除节点/连线 | △ 仅节点 | Delete/Backspace 同时支持选中节点与选中连线 |
| B8 | 添加媒体 | ❌ | 外部拖入 / 系统粘贴图片 / 右键「添加媒体」→ 上传并落盘为 Image 节点 |

### 2.2 画布导航

| ID | 能力 | 现状 | 目标行为 |
|----|------|------|----------|
| N1 | 平移 | △ 中键/空白左键；空格未 pan | 空格+拖、中键拖、右键拖均可平移；滚轮仍为缩放 |
| N2 | 键盘平移 | ❌ | WASD 平移；Shift+WASD 加速（默认 2.5×） |
| N3 | 缩放 | △ 滚轮+右下条；无 E/Q | E 放大、Q 缩小（以视口中心）；保留右下缩放条 |
| N4 | 适应视图 | ✅ | 保持 |
| N5 | 画布开关 | △ 仅 L 吸附 | 左下控件条：网格 / 吸附 / 连线动画 / 锁定视角 |
| N6 | 小地图 | △ 可定位 | 保持定位；增加「展开」与节点标题搜索跳转 |

### 2.3 高级功能

| ID | 能力 | 现状 | 目标行为 |
|----|------|------|----------|
| A1 | 框选与多选 | △ Ctrl+拖框选 | **空白左键拖 = 框选**；空格/中键/右键拖 = 平移；Shift/Cmd/Ctrl 点击加选 |
| A2 | 多选批量操作 | △ 仅批量删除 | 多选浮动工具栏：分组 / 布局 / 打包下载 / 批量删除 |
| A3 | 批量连线 | ❌ | 多选后工具栏出现连线手柄，拖到目标节点 → 选中节点全部连入目标 |
| A4 | 资产管理 | △ 工具调色板 | 左侧资产面板：会话产出/上传图可拖入或「应用」到画布 |

### 2.4 交叉能力（本期纳入）

| ID | 能力 | 说明 |
|----|------|------|
| X1 | 连线类型校验 | 非法连线视觉反馈 + toast（原 Task 2.5.5） |
| X2 | Run All | 拓扑序运行工作流工具节点 |
| X3 | WorkflowTopBar | 返回 / 标题 / 保存态 / Run All / 分享 |
| X4 | 指南文案同步 | `CanvasGuideCapsule` 按本规格更新，与实现一致 |

## 3. 架构决策

**方案：渐进增强现有 CSS InfiniteCanvas（方案 A）**

- 不引入 React Flow；继续在 `InfiniteCanvas` / `InfiniteCanvasContainer` 上扩展手势与控件
- 纯逻辑下沉到 `apps/web/src/lib/canvas-*.ts`（TDD：`scripts/test-*.ts`）
- 交互态集中在 Container；业务提交（上传、Run All）经 `use-design-canvas` / `commitCanvasOps`
- workflow 壳专用 UI（顶栏、资产面板、指南）以 `workflowShell` 门控

**手势冲突消解（关键）：**

| 输入 | 行为 |
|------|------|
| 空白左键拖 | 框选（A1） |
| 空格 + 左键拖 | 平移（N1） |
| 中键拖 | 平移 |
| 右键拖（移动超过阈值） | 平移；未移动抬起 → 上下文菜单 |
| 滚轮 | 缩放 |
| 从 handle 拖到空白 | 打开「连线创建」菜单（B3） |

## 4. 分期（C1 → C4）

### C1 — 导航对齐

- N1 空格/右键 pan；N2 WASD；N3 E/Q；A1 框选手势切换；N5 画布开关条（网格/吸附/锁定；连线动画可先做开关位）
- 更新指南「一、画布导航」与「高级：框选」文案

### C2 — 连线与节点 UX

- B3 拖线到空白建节点；B5 标题重命名；B6 剪刀；B7 键盘删连线；X1 类型校验
- 更新指南「基础操作 / 连线」文案

### C3 — 媒体与资产

- B8 拖入/粘贴/右键上传；A4 资产面板
- 复用现有 session 上传 / outputs API；落盘为 `CanvasItem` Image 节点

### C4 — 批量与运行

- A2 多选工具栏；A3 批量连线；N6 小地图搜索；X2 Run All；X3 WorkflowTopBar
- E2E：`workflow-canvas-guide-parity.spec.ts` 覆盖 C1–C4 冒烟

每期独立分支 / PR：`feature/neowow-canvas-c{1-4}-*`，Squash merge，CI 全绿。

## 5. 关键文件（预期）

| 文件 | 职责 |
|------|------|
| `apps/web/src/lib/canvas-nav.ts` | WASD 步进、E/Q 缩放因子、pan 手势判定 |
| `apps/web/src/lib/canvas-connection-ux.ts` | canConnect、剪刀删除、拖到空白创建意图 |
| `apps/web/src/lib/workflow-topo-sort.ts` | Run All 拓扑序 |
| `apps/web/src/components/infinite-canvas/CanvasChromeBar.tsx` | 网格/吸附/动画/锁定开关 |
| `apps/web/src/components/infinite-canvas/MultiSelectToolbar.tsx` | 多选批量操作 |
| `apps/web/src/components/infinite-canvas/AssetPanel.tsx` | 资产面板 |
| `apps/web/src/components/workflows/WorkflowTopBar.tsx` | workflow 顶栏 |
| `InfiniteCanvas.tsx` / `InfiniteCanvasContainer.tsx` | 手势接线 |
| `CanvasGuideCapsule.tsx` | 文案与截图对齐 |
| `scripts/test-canvas-nav.ts` 等 | 纯函数单测 |
| `apps/web/e2e/workflow-canvas-guide-parity.spec.ts` | E2E |

## 6. 成功标准

- [ ] 截图 §基础操作 B1–B8 均可在 workflow 壳演示
- [ ] 截图 §画布导航 N1–N6 均可演示（N6 搜索可用）
- [ ] 截图 §高级功能 A1–A4 均可演示
- [ ] 指南胶囊文案与行为一致（无「假快捷键」）
- [ ] `pnpm typecheck` + 相关 `scripts/test-*.ts` + E2E 冒烟全绿
- [ ] 每期独立 PR，禁止直推 main

## 7. 风险

| 风险 | 缓解 |
|------|------|
| 框选 vs 平移手势冲突 | §3 消解表；E2E 覆盖两种路径 |
| 右键拖与右键菜单冲突 | 位移阈值（如 4px）区分 click vs drag |
| 资产面板与工具调色板拥挤 | 资产面板可折叠；默认 workflow 展开工具、资产按需打开 |
| Run All 环图 | topo 检测环 → toast 阻断并高亮环边 |
| 媒体上传体积 | 复用现有上传限制与 MIME 校验 |
