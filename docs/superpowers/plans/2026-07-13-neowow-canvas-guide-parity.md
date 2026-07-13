# NeoWOW 画布使用指南对标 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按 C1→C4 补齐 NeoWOW「画布使用指南」截图所列无限画布能力，并使指南文案与行为一致。

**Architecture:** 渐进增强 CSS InfiniteCanvas；纯逻辑下沉 `lib/canvas-*.ts`；手势冲突按设计规格 §3 消解；每期独立 PR。

**Tech Stack:** Next.js 15, React 19, InfiniteCanvas, Hono, Playwright, `scripts/test-*.ts`

**规格：** `docs/superpowers/specs/2026-07-13-neowow-canvas-guide-parity-design.md`

## Global Constraints

- 分支：`feature/neowow-canvas-c1-nav` → `c2-connection` → `c3-media` → `c4-batch-run`（从最新 `main` 开）
- 禁止直推 `main`；Squash merge；CI 全绿
- 本地：`pnpm typecheck`；改 API 时跑相关 integration scripts
- TDD：先写 `scripts/test-*.ts` 再实现
- 中文 UI；指南文案与实现同步更新
- 不引入 React Flow

---

## 文件结构总览

| 文件 | 职责 | 期次 |
|------|------|------|
| `apps/web/src/lib/canvas-nav.ts` | pan/zoom/WASD/E-Q 纯函数 | C1 |
| `scripts/test-canvas-nav.ts` | nav 单测 | C1 |
| `apps/web/src/components/infinite-canvas/CanvasChromeBar.tsx` | 网格/吸附/动画/锁定 | C1 |
| `apps/web/src/lib/canvas-connection-ux.ts` | canConnect、空白落点意图 | C2 |
| `scripts/test-canvas-connection-ux.ts` | 连线 UX 单测 | C2 |
| `apps/web/src/components/infinite-canvas/ConnectionScissors.tsx` | 连线中点剪刀 | C2 |
| `apps/web/src/lib/canvas-media-drop.ts` | 文件 → 画布节点 op | C3 |
| `scripts/test-canvas-media-drop.ts` | 媒体落盘单测 | C3 |
| `apps/web/src/components/infinite-canvas/AssetPanel.tsx` | 资产面板 | C3 |
| `apps/web/src/lib/workflow-topo-sort.ts` | Run All 拓扑 | C4 |
| `scripts/test-workflow-topo-sort.ts` | 拓扑单测 | C4 |
| `apps/web/src/components/infinite-canvas/MultiSelectToolbar.tsx` | 多选工具栏 | C4 |
| `apps/web/src/components/workflows/WorkflowTopBar.tsx` | 顶栏 | C4 |
| `apps/web/e2e/workflow-canvas-guide-parity.spec.ts` | 对标 E2E | C1–C4 增量 |

已有可复用：`canvas-interaction.ts`、`canvas-clipboard.ts`、`canvas-viewport.ts`、`CanvasGuideCapsule.tsx`、`workflow-graph-sync.ts`。

---

# Phase C1 — 导航对齐

### Task C1.1: canvas-nav 纯函数

**Files:**
- Create: `apps/web/src/lib/canvas-nav.ts`
- Create: `scripts/test-canvas-nav.ts`
- Modify: `package.json` — `test:integration` 追加本脚本（若需）

**Interfaces:**
- Produces:
  - `panDeltaFromKey(key: string, shift: boolean, step?: number): { dx: number; dy: number } | null`
  - `zoomFactorFromKey(key: string): number | null` // E → 1.1, Q → 1/1.1
  - `shouldStartPan(input: { spacePressed: boolean; button: number; rightDragMoved: boolean }): boolean`
  - `isContextMenuClick(movedPx: number, threshold?: number): boolean`

- [ ] **Step 1: 写失败测试**

```ts
// scripts/test-canvas-nav.ts
import {
  panDeltaFromKey,
  zoomFactorFromKey,
  shouldStartPan,
  isContextMenuClick,
} from "../apps/web/src/lib/canvas-nav.ts";

const results: { name: string; pass: boolean }[] = [];
function ok(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

ok("W pans up", panDeltaFromKey("w", false)?.dy === -40);
ok("Shift+D pans faster right", (panDeltaFromKey("d", true)?.dx ?? 0) > 40);
ok("E zooms in", (zoomFactorFromKey("e") ?? 0) > 1);
ok("Q zooms out", (zoomFactorFromKey("q") ?? 2) < 1);
ok("space+left starts pan", shouldStartPan({ spacePressed: true, button: 0, rightDragMoved: false }));
ok("middle starts pan", shouldStartPan({ spacePressed: false, button: 1, rightDragMoved: false }));
ok("small move is context menu", isContextMenuClick(2));
ok("large move is drag", !isContextMenuClick(20));

const failed = results.filter((r) => !r.pass);
if (failed.length) process.exit(1);
console.log(`\n${results.length} passed`);
```

- [ ] **Step 2: 运行确认失败**

```bash
pnpm --filter @aimarket/api exec sh -c 'TSX_TSCONFIG_PATH=../web/tsconfig.json tsx ../../scripts/test-canvas-nav.ts'
```

Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 `canvas-nav.ts`**

```ts
const BASE_STEP = 40;
const SHIFT_MULT = 2.5;

export function panDeltaFromKey(
  key: string,
  shift: boolean,
  step = BASE_STEP,
): { dx: number; dy: number } | null {
  const k = key.toLowerCase();
  const s = shift ? step * SHIFT_MULT : step;
  if (k === "w") return { dx: 0, dy: -s };
  if (k === "s") return { dx: 0, dy: s };
  if (k === "a") return { dx: -s, dy: 0 };
  if (k === "d") return { dx: s, dy: 0 };
  return null;
}

export function zoomFactorFromKey(key: string): number | null {
  const k = key.toLowerCase();
  if (k === "e") return 1.1;
  if (k === "q") return 1 / 1.1;
  return null;
}

export function shouldStartPan(input: {
  spacePressed: boolean;
  button: number;
  rightDragMoved: boolean;
}): boolean {
  if (input.button === 1) return true;
  if (input.spacePressed && input.button === 0) return true;
  if (input.button === 2 && input.rightDragMoved) return true;
  return false;
}

export function isContextMenuClick(movedPx: number, threshold = 4): boolean {
  return movedPx < threshold;
}
```

- [ ] **Step 4: 运行确认通过**

Expected: `8 passed`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/canvas-nav.ts scripts/test-canvas-nav.ts
git commit -m "test(canvas): add canvas-nav helpers for pan/zoom keys"
```

---

### Task C1.2: InfiniteCanvas 手势接线（空格 pan / 右键拖 / WASD / E-Q / 框选切换）

**Files:**
- Modify: `apps/web/src/components/infinite-canvas/InfiniteCanvas.tsx`
- Modify: `apps/web/src/components/infinite-canvas/InfiniteCanvasContainer.tsx`

**Interfaces:**
- Consumes: `panDeltaFromKey`, `zoomFactorFromKey`, `shouldStartPan`, `isContextMenuClick`
- Produces: 空白左键拖 = 框选；空格/中键/右键拖 = 平移

- [ ] **Step 1: InfiniteCanvas 空格按下时允许进入 pan 模式**

在已有 `isSpacePressed` 上：space+pointerdown(button0) 启动与中键相同的 pan 逻辑（更新 viewport.x/y）。

- [ ] **Step 2: 右键拖平移**

`pointerdown` button===2 记录起点；`pointermove` 超过 4px 则 `shouldStartPan({..., rightDragMoved:true})` 并 pan；`pointerup` 若 `isContextMenuClick(moved)` 则触发原 contextmenu，否则吞掉菜单。

- [ ] **Step 3: 空白左键拖改为框选（Container）**

取消「空白左键直接 pan」。Container：`button===0 && !space && !ctrl` 启动 marquee（原仅 ctrl/meta 才框选的逻辑改为默认框选；可选保留 ctrl 兼容）。

- [ ] **Step 4: keyboard WASD / E / Q**

在 Container `keydown`（非 input/textarea/contenteditable）：

```ts
const delta = panDeltaFromKey(e.key, e.shiftKey);
if (delta) {
  e.preventDefault();
  onViewportChange({ ...viewport, x: viewport.x - delta.dx * viewport.k, y: viewport.y - delta.dy * viewport.k });
  return;
}
const zf = zoomFactorFromKey(e.key);
if (zf) {
  e.preventDefault();
  // zoom about viewport center using existing zoom helper
}
```

- [ ] **Step 5: typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(canvas): align pan/zoom gestures with NeoWOW guide (C1)"
```

---

### Task C1.3: CanvasChromeBar（网格 / 吸附 / 连线动画 / 锁定视角）

**Files:**
- Create: `apps/web/src/components/infinite-canvas/CanvasChromeBar.tsx`
- Modify: `InfiniteCanvasContainer.tsx` — 左下指南胶囊旁挂载
- Modify: `InfiniteCanvas.tsx` — 接收 `gridVisible` / `viewLocked` props

**Interfaces:**
- Produces: UI toggles → state `{ gridOn, snapOn, edgeAnimOn, viewLocked }`
- Consumes: 现有 `snapToGridEnabled`；viewLocked 时禁止 pan/zoom

- [ ] **Step 1: 实现 ChromeBar**

四个 icon toggle，`data-testid`：`canvas-toggle-grid` / `snap` / `edge-anim` / `lock-view`。

- [ ] **Step 2: 接线**

- `gridOn` → 背景 lines/blank  
- `snapOn` → 现有 snap state（与 L 同步）  
- `edgeAnimOn` → 连线 `strokeDasharray` 动画 class  
- `viewLocked` → InfiniteCanvas 忽略 pan/zoom 输入  

- [ ] **Step 3: 更新 CanvasGuideCapsule 导航章节**

写入：空格/中键/右键拖平移；WASD；E/Q；空白拖框选；左下开关条。

- [ ] **Step 4: E2E 冒烟片段**（可先加到 `workflow-canvas-basics.spec.ts`）

```ts
await expect(page.getByTestId("canvas-toggle-snap")).toBeVisible();
await page.keyboard.press("KeyL"); // snap still works
```

- [ ] **Step 5: Commit + 开 PR `feature/neowow-canvas-c1-nav`**

```bash
git commit -m "feat(canvas): add chrome toggles and sync guide copy (C1)"
```

---

# Phase C2 — 连线与节点 UX

### Task C2.1: canConnect + 拖到空白意图

**Files:**
- Create: `apps/web/src/lib/canvas-connection-ux.ts`
- Create: `scripts/test-canvas-connection-ux.ts`
- Modify: `apps/web/src/lib/workflow-tool-registry.ts` — 可选 `inputKinds` / `outputKinds`

**Interfaces:**
- Produces:
  - `canConnectNodes(source: CanvasNodeData, target: CanvasNodeData): { ok: boolean; reason?: string }`
  - `connectionDropIntent(hitNodeId: string | null, worldPos: {x,y}): "connect" | "create-at-drop" | "cancel"`

- [ ] **Step 1: 失败测试** — AUDIO→IMAGE 拒绝；IMAGE→OUTPAINTING 允许；无 hit → create-at-drop
- [ ] **Step 2: 实现纯函数**
- [ ] **Step 3: 测试通过 + Commit**

```bash
git commit -m "feat(canvas): connection type checks and drop intent helpers"
```

---

### Task C2.2: 拖线到空白 → ConnectionCreateMenu 自动连线

**Files:**
- Modify: `InfiniteCanvasContainer.tsx` — connect mouseUp 无目标时打开菜单于落点
- Modify: `ConnectionCreateMenu.tsx` / `use-design-canvas.tsx` — 创建后 `connect_nodes`

- [ ] **Step 1:** mouseUp：`connectionDropIntent` → `create-at-drop` 时 setState 菜单（fromNodeId + worldPos）
- [ ] **Step 2:** 选类型后 `add_node` + `connect_nodes`（复用 `handleCreateDownstreamNode` 逻辑）
- [ ] **Step 3:** 非法目标 hover 时 handle 变红 + toast reason
- [ ] **Step 4:** Commit

```bash
git commit -m "feat(canvas): create node by dropping connection on empty canvas"
```

---

### Task C2.3: 连线剪刀 + 键盘删连线 + 标题重命名

**Files:**
- Create: `apps/web/src/components/infinite-canvas/ConnectionScissors.tsx`
- Modify: `CanvasConnections.tsx` / `InfiniteCanvasContainer.tsx`
- Modify: `CanvasNode.tsx` — 标题双击编辑
- Modify: `use-design-canvas.tsx` — Delete 同时清 `selectedConnectionId`

- [ ] **Step 1: ConnectionScissors**

选中连线时在 path 中点渲染剪刀按钮 `data-testid="connection-scissors"`，点击 → 删该连线。

- [ ] **Step 2: Delete/Backspace**

若有 `selectedConnectionId` 优先删连线；否则删选中节点。

- [ ] **Step 3: 双击标题重命名**

`CanvasNode` header：双击 → input；Enter/blur → `update_node` patch `{ title }`。

- [ ] **Step 4: 更新指南「基础操作」文案**（B3/B5/B6/B7）
- [ ] **Step 5: typecheck + Commit + PR `feature/neowow-canvas-c2-connection`**

```bash
git commit -m "feat(canvas): scissors, rename title, keyboard delete edge (C2)"
```

---

# Phase C3 — 媒体与资产

### Task C3.1: 文件落盘纯函数

**Files:**
- Create: `apps/web/src/lib/canvas-media-drop.ts`
- Create: `scripts/test-canvas-media-drop.ts`

**Interfaces:**
- Produces:
  - `filterMediaFiles(files: File[]): File[]` // image/* video/*
  - `mediaDropPositions(count: number, origin: {x,y}, gap?: number): {x,y}[]`

- [ ] **Step 1–4:** TDD 实现 + Commit

```bash
git commit -m "test(canvas): media drop file filter and layout helpers"
```

---

### Task C3.2: 拖入 / 粘贴 / 右键添加媒体

**Files:**
- Modify: `InfiniteCanvasContainer.tsx` — `onDragOver`/`onDrop`、paste 监听
- Modify: `NodeCreateMenu.tsx` — 「上传图片/视频」
- Modify: `use-design-canvas.tsx` — 调用现有 upload API → `add_node` Image/Video

- [ ] **Step 1:** 将 `onDrop` 从 InfiniteCanvas 贯通到 Container
- [ ] **Step 2:** paste：若 `clipboardData.files` 有媒体则上传，否则保持节点图粘贴
- [ ] **Step 3:** 右键菜单项触发 `<input type=file accept="image/*,video/*">`
- [ ] **Step 4:** E2E 可选：mock file chooser
- [ ] **Step 5: Commit**

```bash
git commit -m "feat(canvas): drop/paste/context-menu media upload (C3)"
```

---

### Task C3.3: AssetPanel

**Files:**
- Create: `apps/web/src/components/infinite-canvas/AssetPanel.tsx`
- Modify: workflow 壳布局（`workflow-page-client` / `DesignCanvasView`）— 左栏 Tab：工具 | 资产

**行为：**
- 列表：当前 session `items` 中有 url 的图片/视频
- 拖到画布 → 在落点克隆节点（新 id）
- 「应用」→ 视口中心添加

- [ ] **Step 1:** UI + data-testid `asset-panel`
- [ ] **Step 2:** 拖放 / 应用接线
- [ ] **Step 3:** 指南「资产管理」文案
- [ ] **Step 4: Commit + PR `feature/neowow-canvas-c3-media`**

```bash
git commit -m "feat(canvas): session asset panel with drag-apply (C3)"
```

---

# Phase C4 — 批量与运行

### Task C4.1: workflow-topo-sort

**Files:**
- Create: `apps/web/src/lib/workflow-topo-sort.ts`
- Create: `scripts/test-workflow-topo-sort.ts`

**Interfaces:**
- Produces:
  - `topoSortWorkflowNodes(nodes, edges): { order: string[]; cycle: boolean }`

- [ ] **Step 1: 测试** — 线性 A→B→C；菱形；有环 → cycle true
- [ ] **Step 2: Kahn / DFS 实现**
- [ ] **Step 3: Commit**

```bash
git commit -m "feat(workflow): topo sort for Run All"
```

---

### Task C4.2: MultiSelectToolbar + 批量连线

**Files:**
- Create: `apps/web/src/components/infinite-canvas/MultiSelectToolbar.tsx`
- Modify: `InfiniteCanvasContainer.tsx` / `use-design-canvas.tsx`

**工具栏动作：**
- 分组 → 现有 `group_nodes` op
- 布局 → 复用 `canvas-batch-layout` 或简单网格
- 打包下载 → 选中节点 content URL 打 zip（若无 zip 工具则逐个 download + toast「已开始下载 N 项」）
- 删除 → 现有 delete
- 批量连线手柄：拖到目标 → 对每个选中 id `connect_nodes`

- [ ] **Step 1:** 选中 ≥2 显示工具栏（selection bbox 上方）
- [ ] **Step 2:** 四动作 + 批量连线
- [ ] **Step 3: Commit**

```bash
git commit -m "feat(canvas): multi-select toolbar and batch connect (C4)"
```

---

### Task C4.3: WorkflowTopBar + Run All

**Files:**
- Create: `apps/web/src/components/workflows/WorkflowTopBar.tsx`
- Modify: `apps/web/src/app/workflow/workflow-page-client.tsx`（或 studio-workspace workflow 入口）
- Modify: `use-design-canvas.tsx` — `runAllWorkflowNodes`

**Run All 算法：**
1. `topoSortWorkflowNodes`；若 cycle → toast 并 return  
2. 按 order 过滤 `workflowToolType` 节点  
3. 依次 `handleRunWorkflowNode`；等待该节点 status success/error（复用 poller）再跑下一个  
4. 顶栏显示「运行中 i/n」

- [ ] **Step 1: TopBar UI** — 返回、标题、保存态、Run All、分享
- [ ] **Step 2: runAll 接线**
- [ ] **Step 3: E2E 顶栏可见 + Run All 按钮存在
- [ ] **Step 4: Commit**

```bash
git commit -m "feat(workflow): top bar and Run All topo execution (C4)"
```

---

### Task C4.4: 小地图搜索 + 指南全文对齐 + E2E 对标

**Files:**
- Modify: `CanvasMiniMap.tsx` — 展开面板 + 搜索 input，命中则 `setViewport` 居中该节点
- Modify: `CanvasGuideCapsule.tsx` — 全文对齐规格 §2
- Create: `apps/web/e2e/workflow-canvas-guide-parity.spec.ts`

**E2E 最小集：**

```ts
test("指南胶囊章节齐全", async ({ page, request }) => { /* open guide, expect 基础/导航/高级 */ });
test("适应视图与 chrome 开关可见", async ({ page, request }) => { /* ... */ });
test("顶栏 Run All 可见", async ({ page, request }) => { /* workflowShell */ });
test("资产面板可打开", async ({ page, request }) => { /* ... */ });
```

- [ ] **Step 1–3:** 实现 + E2E 绿
- [ ] **Step 4: typecheck + Commit + PR `feature/neowow-canvas-c4-batch-run`**

```bash
git commit -m "feat(canvas): minimap search, guide parity, E2E (C4)"
```

---

## 验收矩阵

| 规格 ID | Task | 验收 |
|---------|------|------|
| N1–N3, A1, N5 | C1.1–C1.3 | 单测 + 手动/E2E |
| B3, B5–B7, X1 | C2.1–C2.3 | 单测 + E2E |
| B8, A4 | C3.1–C3.3 | 单测 + E2E |
| A2, A3, N6, X2, X3 | C4.1–C4.4 | 单测 + E2E |
| X4 | 各期末更新指南 | 文案 diff review |

## 推荐 PR 顺序

```
C1 nav PR  → merge → deploy
C2 connection PR → merge → deploy
C3 media PR → merge → deploy
C4 batch-run PR → merge → deploy + 全量 parity E2E
```

## Self-Review

- [x] 规格 §2 每条能力映射到 Task
- [x] 无 TBD 占位
- [x] 接口名前后一致（`panDeltaFromKey` / `topoSortWorkflowNodes` / `connectionDropIntent`）
- [x] 与已完成 Phase 2.5（fitView/clipboard/snap/guide）不重复实现，仅扩展
