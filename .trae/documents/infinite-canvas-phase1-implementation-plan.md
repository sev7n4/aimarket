# Infinite Canvas Phase 1 实施计划

> 基于 `infinite-canvas-integration-prd.md` 和 `specs/infinite-canvas-integration/tasks.md`，细化 Phase 1（P0）的具体实施步骤。

---

## 一、当前状态分析

### 已有代码

| 文件 | 状态 | 说明 |
|------|------|------|
| `apps/web/src/components/infinite-canvas/` | **不存在** | 需要新建整个目录 |
| `apps/web/src/components/design-canvas.tsx` (978 行) | 存在 | 三路分支：alternateCanvasContent / FreeCanvas / ScrollCanvas |
| `apps/web/src/components/free-canvas.tsx` (1339 行) | 存在 | 有自己的 zoom/pan 实现，支持 mask brush / refine / expand |
| `apps/web/src/components/scroll-canvas.tsx` (753 行) | 存在 | 纵向批次滚动列表 |
| `apps/web/src/lib/canvas-tools.ts` (672 行) | 存在 | CanvasItem 类型、buildCanvasItemsFromMessages、BatchSection |
| `apps/web/src/components/studio-canvas-with-orchestration.tsx` (264 行) | 存在 | 根据 drama 状态切换 alternateCanvasContent |

### 主题系统

- aimarket 使用 **自定义 CSS 变量 + Tailwind CSS v4**（`--am-bg`, `--am-surface`, `--am-border`, `--am-accent-from` 等）
- infinite-canvas 使用独立的 `canvasThemes` 常量（light/dark 双主题）
- **适配策略**：在 aimarket 中新建 `canvas-theme.ts`，将 infinite-canvas 的 `canvasThemes.dark` 色值映射到 aimarket CSS 变量

### UI 组件库

- aimarket 使用 **`@aimarket/ui`**（Button、GlassPanel、ModeTabs、cn）
- aimarket **不使用 shadcn/ui、antd**
- infinite-canvas 的 canvas-zoom-controls 依赖 antd（Button/Modal/Tooltip）
- **适配策略**：antd 组件替换为 aimarket 自有组件或原生 HTML

### 关键约束

1. Phase 1 必须 **保留 `alternateCanvasContent` 兼容层**，不破坏现有 Drama 功能
2. `CanvasItem` → `CanvasNodeData` 需要双向转换（migration.ts）
3. 无限画布引擎只替换底层渲染，上层工具栏/Lightbox/右键菜单/撤销重做保留
4. 精修模式（mask brush/expand/focus click）在 Phase 1 暂时保留在 FreeCanvas 中，Phase 2 再迁移

---

## 二、实施步骤

### Step 1: 创建类型与常量基础

**新建文件**：`apps/web/src/components/infinite-canvas/types.ts`

从 `/Users/4seven/workspace/infinite-canvas/web/src/app/(user)/canvas/types.ts` 移植，适配改动：

```typescript
// 核心类型 — 直接移植
export type Position = { x: number; y: number };
export type ViewportTransform = { x: number; y: number; k: number };

// CanvasNodeType — 增加 Drama 类型占位
export enum CanvasNodeType {
  Text = "text",
  Image = "image",
  Config = "config",
  Video = "video",
  Audio = "audio",
  // Phase 2 填充
  Script = "script",
  Shot = "shot",
  Character = "character",
  Scene = "scene",
}

// CanvasNodeStatus — 直接移植
export type CanvasNodeStatus = "idle" | "success" | "loading" | "error";

// CanvasNodeMetadata — 扁平化可选字段，去除 CanvasAssistantMessage 等对话类型
export type CanvasNodeMetadata = {
  content?: string;
  status?: CanvasNodeStatus;
  fontSize?: number;
  generationMode?: "image" | "video" | "audio";
  naturalWidth?: number;
  naturalHeight?: number;
  freeResize?: boolean;
  isBatchRoot?: boolean;
  batchRootId?: string;
  batchIndex?: number;
  // Phase 2 Drama 扩展占位
  // scriptTitle?: string; logline?: string; acts?: ...
  // shotDialogue?: string; visualPrompt?: string; ...
  // characterVisualSignature?: string; ...
  // sceneLocation?: string; atmosphere?: string; ...
};

export type CanvasNodeData = {
  id: string;
  type: CanvasNodeType;
  title: string;
  position: Position;
  width: number;
  height: number;
  metadata?: CanvasNodeMetadata;
};

export type CanvasConnection = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
};

export type SelectionBox = {
  startX: number; startY: number;
  endX: number; endY: number;
};

export type ContextMenuState = {
  x: number; y: number;
  nodeId?: string;
  connectionId?: string;
};

export type ConnectionHandle = {
  nodeId: string;
  handleType: "source" | "target";
};
```

**去除项**：
- `CanvasAssistantMessage` / `CanvasAssistantSession` / `CanvasAssistantReference`（Phase 3 引入）
- `CanvasResourceReference` 相关（Phase 3 引入）

---

**新建文件**：`apps/web/src/components/infinite-canvas/constants.ts`

从 `/Users/4seven/workspace/infinite-canvas/web/src/app/(user)/canvas/constants.ts` 移植，适配改动：

```typescript
import { CanvasNodeType, type CanvasNodeMetadata } from "./types";

type CanvasNodeSpec = {
  width: number;
  height: number;
  title: string;
  metadata?: CanvasNodeMetadata;
};

export const NODE_DEFAULT_SIZE = {
  [CanvasNodeType.Image]: { width: 340, height: 240, title: "New Generation" },
  [CanvasNodeType.Text]: { width: 340, height: 240, title: "Note" },
  [CanvasNodeType.Config]: { width: 340, height: 240, title: "生成配置" },
  [CanvasNodeType.Video]: { width: 420, height: 236, title: "Video" },
  [CanvasNodeType.Audio]: { width: 340, height: 120, title: "Audio" },
  // Phase 2 填充实际值
  [CanvasNodeType.Script]: { width: 400, height: 300, title: "新剧本" },
  [CanvasNodeType.Shot]: { width: 360, height: 260, title: "新分镜" },
  [CanvasNodeType.Character]: { width: 340, height: 280, title: "新角色" },
  [CanvasNodeType.Scene]: { width: 360, height: 240, title: "新场景" },
} satisfies Record<CanvasNodeType, { width: number; height: number; title: string }>;

export const NODE_SPECS = {
  // ... 同原文件结构，增加 Drama 节点 spec 占位
} satisfies Record<CanvasNodeType, CanvasNodeSpec>;

export function getNodeSpec(type: CanvasNodeType) {
  return NODE_SPECS[type];
}
```

---

### Step 2: 创建画布主题适配层

**新建文件**：`apps/web/src/components/infinite-canvas/canvas-theme.ts`

infinite-canvas 使用 `canvasThemes` 常量，aimarket 使用 CSS 变量。创建适配层，将 infinite-canvas 的主题结构映射到 aimarket 的 CSS 变量：

```typescript
export type CanvasBackgroundMode = "dots" | "lines" | "blank";

// 将 aimarket CSS 变量映射为 infinite-canvas 主题结构
export const canvasTheme = {
  canvas: {
    background: "var(--am-bg, #050505)",
    dot: "rgba(245,245,244,.24)",
    line: "rgba(245,245,244,.10)",
    selectionStroke: "#fafaf9",
    selectionFill: "rgba(250,250,249,.10)",
  },
  node: {
    label: "#d6d3d1",
    fill: "var(--am-surface, rgba(255,255,255,0.04))",
    panel: "var(--am-surface-strong, rgba(255,255,255,0.08))",
    stroke: "var(--am-border, rgba(255,255,255,0.1))",
    activeStroke: "#fafaf9",
    placeholder: "#a8a29e",
    text: "#f5f5f4",
    muted: "#d6d3d1",
    faint: "#78716c",
  },
  toolbar: {
    panel: "var(--am-surface-strong, rgba(255,255,255,0.08))",
    border: "var(--am-border, rgba(255,255,255,0.1))",
    item: "#d6d3d1",
    itemHover: "rgba(255,255,255,0.04)",
    activeBg: "rgba(255,255,255,0.12)",
    activeText: "#f5f5f4",
  },
} as const;
```

**关键决策**：aimarket 目前只有暗色主题，因此直接导出 `canvasTheme` 常量（而非 light/dark 切换），颜色值对齐 `canvasThemes.dark` 并用 CSS 变量替代硬编码色值。后续如需支持亮色主题，改为 `useCanvasTheme()` hook 读取 CSS 变量计算值。

---

### Step 3: 移植 InfiniteCanvas + CanvasGrid

**新建文件**：`apps/web/src/components/infinite-canvas/InfiniteCanvas.tsx`

从 `/Users/4seven/workspace/infinite-canvas/web/src/app/(user)/canvas/components/infinite-canvas.tsx` (215 行) 移植，适配改动：

| 改动点 | 原代码 | 适配后 |
|--------|--------|--------|
| 主题引入 | `canvasThemes[useThemeStore(s => s.theme)]` | `canvasTheme`（直接导入常量） |
| antd 过滤 | `.ant-modal,.ant-popover,.ant-dropdown,.ant-select-dropdown,.ant-picker-dropdown` | 移除，改为 `[data-canvas-no-zoom],[data-dialog],[data-popover]` |
| CanvasGrid | 内部组件 | 提取为同文件内组件（保持原样） |

InfiniteCanvasProps 保持一致：
```typescript
type InfiniteCanvasProps = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  viewport: ViewportTransform;
  backgroundMode?: CanvasBackgroundMode;
  onViewportChange: (viewport: ViewportTransform) => void;
  onCanvasMouseDown?: (event: React.PointerEvent<HTMLDivElement>) => void;
  onCanvasDeselect?: () => void;
  onContextMenu?: (event: React.MouseEvent) => void;
  onDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
  children: React.ReactNode;
};
```

---

### Step 4: 移植 CanvasNode

**新建文件**：`apps/web/src/components/infinite-canvas/CanvasNode.tsx`

从 `/Users/4seven/workspace/infinite-canvas/web/src/app/(user)/canvas/components/canvas-node.tsx` (679 行) 移植，适配改动：

| 改动点 | 原代码 | 适配后 |
|--------|--------|--------|
| 主题 | `canvasThemes[useThemeStore(s => s.theme)]` | `canvasTheme` |
| antd 组件 | 无直接 antd 依赖 | 不需要替换 |
| CanvasResourceMentionTextarea | 引入自同目录 | **移除**（Phase 3 引入），TextContent 编辑改用普通 textarea |
| nodeContentRenderers | Text/Image/Video/Audio/Config 5 种 | 保持 5 种，Drama 类型 Phase 2 扩展 |
| imageToDataUrl | 从 `@/services/image-storage` 引入 | 需适配 aimarket 的图片 URL 方案 |

CanvasNodeProps 保持一致，但去除 `resourceLabel` / `mentionReferences`（Phase 3）。

节点内容渲染器（Phase 1 仅 5 种基础类型）：
- `TextContent`：纯文本编辑
- `ImageNodeContent`：图片展示 + 状态角标
- `VideoNodeContent`：视频播放器
- `AudioNodeContent`：音频播放器
- Config 类型：通过 `renderNodeContent` prop 自定义

---

### Step 5: 移植 CanvasConnections

**新建文件**：`apps/web/src/components/infinite-canvas/CanvasConnections.tsx`

从 `/Users/4seven/workspace/infinite-canvas/web/src/app/(user)/canvas/components/canvas-connections.tsx` (78 行) 移植，适配改动：

| 改动点 | 原代码 | 适配后 |
|--------|--------|--------|
| 主题 | `canvasThemes[useThemeStore(s => s.theme)]` | `canvasTheme` |

此文件改动最小，基本直接移植。

---

### Step 6: 移植辅助组件

**新建文件**：`apps/web/src/components/infinite-canvas/CanvasMiniMap.tsx`

从 infinite-canvas 的 `canvas-mini-map.tsx` (138 行) 移植，适配改动：
- 主题 → `canvasTheme`
- 节点类型颜色保持原映射

**新建文件**：`apps/web/src/components/infinite-canvas/CanvasZoomControls.tsx`

从 infinite-canvas 的 `canvas-zoom-controls.tsx` (81 行) 移植，适配改动：

| 改动点 | 原代码 | 适配后 |
|--------|--------|--------|
| antd Button | `<Button ...>` | 使用 `@aimarket/ui` 的 Button 或原生 `<button>` |
| antd Modal | 快捷键帮助弹窗 | 使用原生 `<dialog>` 或 aimarket 自有弹窗 |
| antd Tooltip | 悬停提示 | 使用 HTML `title` 属性（简化方案） |
| 主题 | `canvasThemes[...]` | `canvasTheme` |

---

### Step 7: 移植 Op 抽象层

**新建文件**：`apps/web/src/components/infinite-canvas/utils.ts`

从 `/Users/4seven/workspace/infinite-canvas/web/src/app/(user)/canvas/utils/canvas-agent-ops.ts` (96 行) 移植，适配改动：

- 预留 Drama Op 扩展位（Phase 3 填充）
- `nanoid` 依赖确认 aimarket 已安装（检查 package.json）
- `getNodeSpec` 导入路径调整

```typescript
export type CanvasAgentOp =
  | { type: "add_node"; id?: string; nodeType?: CanvasNodeType; ... }
  | { type: "update_node"; id: string; patch?: ...; metadata?: ... }
  | { type: "delete_node"; id?: string; ids?: string[]; nodeType?: CanvasNodeType }
  | { type: "delete_connections"; id?: string; ids?: string[]; all?: boolean }
  | { type: "connect_nodes"; id?: string; fromNodeId: string; toNodeId: string }
  | { type: "set_viewport"; viewport: ViewportTransform }
  | { type: "select_nodes"; ids: string[] }
  | { type: "run_generation"; nodeId: string; mode?: ...; prompt?: string };
  // Phase 3 增加: plan_drama | generate_character_sheet | ...
```

---

### Step 8: 数据迁移层

**新建文件**：`apps/web/src/components/infinite-canvas/migration.ts`

核心转换函数：

```typescript
// CanvasItem → CanvasNodeData
export function canvasItemToNodeData(item: CanvasItem): CanvasNodeData {
  return {
    id: item.id,
    type: item.isVideo ? CanvasNodeType.Video : CanvasNodeType.Image,
    title: item.label || item.batchTitle || "",
    position: { x: item.x, y: item.y },
    width: item.width,
    height: item.height,
    metadata: {
      content: item.url,
      status: "idle",
      naturalWidth: item.width,
      naturalHeight: item.height,
      batchRootId: item.batchId,
      batchIndex: item.batchIndex,
    },
  };
}

// CanvasNodeData → CanvasItem
export function nodeDataToCanvasItem(node: CanvasNodeData): CanvasItem {
  // 反向映射
}

// BatchSection → Batch 根节点
export function batchSectionToBatchNodes(section: BatchSection, items: CanvasItem[]): CanvasNodeData[] {
  // 将批次内 items 转换为 BatchFrame 节点组
}
```

---

### Step 9: 创建 InfiniteCanvas 容器组件

**新建文件**：`apps/web/src/components/infinite-canvas/InfiniteCanvasContainer.tsx`

这是一个编排层组件，将 InfiniteCanvas + CanvasNode + CanvasConnections + MiniMap + ZoomControls 组合在一起，提供完整的画布交互能力：

```typescript
type InfiniteCanvasContainerProps = {
  nodes: CanvasNodeData[];
  connections: CanvasConnection[];
  viewport: ViewportTransform;
  selectedNodeIds: string[];
  onNodesChange: (nodes: CanvasNodeData[]) => void;
  onConnectionsChange: (connections: CanvasConnection[]) => void;
  onViewportChange: (viewport: ViewportTransform) => void;
  onSelectionChange: (ids: string[]) => void;
  renderNodeContent?: (node: CanvasNodeData) => ReactNode;
  renderPanel?: (node: CanvasNodeData) => ReactNode;
};
```

此组件管理：
- 节点拖拽 / 缩放 / 连线创建
- 多选框选
- 右键上下文菜单
- 小地图 + 缩放控件
- 撤销/重做（通过 `CanvasAgentOp[]` 快照）

---

### Step 10: 改造 design-canvas.tsx

**修改文件**：`apps/web/src/components/design-canvas.tsx`

#### 10.1 新增 InfiniteCanvas 渲染路径

在现有的三路分支中增加 InfiniteCanvas 路径：

```typescript
// 修改前
{alternateCanvasContent ? (
  <div ...>{alternateCanvasContent}</div>
) : showFreeCanvas ? (
  <FreeCanvas ... />
) : (
  <ScrollCanvas ... />
)}

// 修改后（Phase 1 兼容方案）
{alternateCanvasContent ? (
  <div ...>{alternateCanvasContent}</div>  // 保留，Phase 2 移除
) : useInfiniteCanvas ? (
  <InfiniteCanvasContainer ... />  // 新路径
) : showFreeCanvas ? (
  <FreeCanvas ... />  // 保留，作为 fallback
) : (
  <ScrollCanvas ... />  // 保留，作为 fallback
)}
```

#### 10.2 CanvasItem → CanvasNodeData 适配

- `items` prop 通过 `canvasItemToNodeData` 转换为 `CanvasNodeData[]`
- 节点变更通过 `nodeDataToCanvasItem` 反向转换为 `CanvasItem[]`，再调用 `onItemsChange`
- `batchSections` → `CanvasConnection[]`（批次关系映射为连线）

#### 10.3 DesignCanvasProps 扩展

```typescript
// 新增可选 prop
interface DesignCanvasProps extends ... {
  /** 切换到无限画布模式（Phase 1 默认 false，Phase 2 默认 true） */
  useInfiniteCanvas?: boolean;
}
```

---

### Step 11: 改造 studio-canvas-with-orchestration.tsx

**修改文件**：`apps/web/src/components/studio-canvas-with-orchestration.tsx`

Phase 1 仅做最小改动：

- 传入 `useInfiniteCanvas={true}` 给 `DesignCanvas`
- 保留 `alternateCanvasContent` 逻辑（兼容现有 Drama 功能）
- DramaStudioPanel 仍作为 `orchestrationExtra` 底部注入

Phase 2 再做：
- 移除 `alternateCanvasContent` 替换逻辑
- DramaStudioPanel 迁移到右侧面板

---

### Step 12: 验证

1. `npx tsc --noEmit` — TypeScript 编译零错误
2. 手动验证画布平移/缩放（0.05x-5x），以鼠标中心缩放
3. 手动验证节点拖拽/缩放/选中
4. 手动验证连线创建/删除
5. 手动验证小地图和缩放控件
6. 手动验证旧项目数据无损迁移（CanvasItem → CanvasNodeData 双向转换）
7. 手动验证现有素材生成流程不受影响（ScrollCanvas/FreeCanvas fallback 路径仍可用）
8. 手动验证 Drama 功能不受影响（alternateCanvasContent 保留）

---

## 三、新建文件清单

| # | 文件路径 | 来源 | 预估行数 |
|---|---------|------|---------|
| 1 | `apps/web/src/components/infinite-canvas/types.ts` | 改编自 infinite-canvas/types.ts | ~80 |
| 2 | `apps/web/src/components/infinite-canvas/constants.ts` | 改编自 infinite-canvas/constants.ts | ~60 |
| 3 | `apps/web/src/components/infinite-canvas/canvas-theme.ts` | 适配层（新建） | ~50 |
| 4 | `apps/web/src/components/infinite-canvas/InfiniteCanvas.tsx` | 改编自 infinite-canvas/infinite-canvas.tsx | ~220 |
| 5 | `apps/web/src/components/infinite-canvas/CanvasNode.tsx` | 改编自 infinite-canvas/canvas-node.tsx | ~600 |
| 6 | `apps/web/src/components/infinite-canvas/CanvasConnections.tsx` | 改编自 infinite-canvas/canvas-connections.tsx | ~80 |
| 7 | `apps/web/src/components/infinite-canvas/CanvasMiniMap.tsx` | 改编自 infinite-canvas/canvas-mini-map.tsx | ~140 |
| 8 | `apps/web/src/components/infinite-canvas/CanvasZoomControls.tsx` | 改编自 infinite-canvas/canvas-zoom-controls.tsx | ~80 |
| 9 | `apps/web/src/components/infinite-canvas/utils.ts` | 改编自 infinite-canvas/canvas-agent-ops.ts | ~100 |
| 10 | `apps/web/src/components/infinite-canvas/migration.ts` | 新建 | ~80 |
| 11 | `apps/web/src/components/infinite-canvas/InfiniteCanvasContainer.tsx` | 新建 | ~350 |

## 四、修改文件清单

| # | 文件路径 | 改动范围 |
|---|---------|---------|
| 1 | `apps/web/src/components/design-canvas.tsx` | 新增 InfiniteCanvas 渲染路径（~30 行新增 + import） |
| 2 | `apps/web/src/components/studio-canvas-with-orchestration.tsx` | 传入 `useInfiniteCanvas` prop（~3 行） |

---

## 五、关键决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 主题适配 | 直接导出 `canvasTheme` 常量，色值对齐 dark 主题 | aimarket 仅暗色主题，避免引入 zustand theme store |
| antd 替换 | 原生 HTML + `@aimarket/ui` Button | 不引入新 UI 库依赖 |
| Phase 1 画布切换策略 | 新增 `useInfiniteCanvas` prop，默认 false | 向后兼容，可灰度切换 |
| CanvasResourceMentionTextarea | 移除，改用普通 textarea | Phase 3 引入 |
| 精修模式 | 暂保留 FreeCanvas | Phase 2 迁移到 InfiniteCanvas |
| nanoid 依赖 | 确认 aimarket 已有或新增 | Op 抽象层需要 |

---

## 六、风险与缓解

| 风险 | 缓解 |
|------|------|
| CanvasNode 679 行移植量大，细节遗漏 | 逐段移植 + TypeScript 类型检查 |
| 节点内容渲染器依赖 imageToDataUrl 等 infinite-canvas 专有工具 | 用 aimarket 的 assetUrl 替代 |
| Batch 图片组逻辑复杂 | Phase 1 先保留基础渲染，Batch 简化为独立节点 |
| 无限画布模式与精修模式冲突 | Phase 1 精修仍走 FreeCanvas，互不干扰 |

---

## 七、执行顺序

```
Step 1 (types.ts + constants.ts)
    ↓
Step 2 (canvas-theme.ts)
    ↓
Step 3 (InfiniteCanvas.tsx)  ← 依赖 Step 1+2
Step 4 (CanvasNode.tsx)      ← 依赖 Step 1+2
Step 5 (CanvasConnections.tsx) ← 依赖 Step 1+2
Step 6 (CanvasMiniMap.tsx + CanvasZoomControls.tsx) ← 依赖 Step 1+2
Step 7 (utils.ts)            ← 依赖 Step 1
    ↓ （以上可并行）
Step 8 (migration.ts)        ← 依赖 Step 1
    ↓
Step 9 (InfiniteCanvasContainer.tsx) ← 依赖 Step 3-8
    ↓
Step 10 (design-canvas.tsx)  ← 依赖 Step 9
Step 11 (studio-canvas-with-orchestration.tsx) ← 依赖 Step 10
    ↓
Step 12 (验证)
```
