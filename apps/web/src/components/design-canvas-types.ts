import type { ReactNode } from "react";
import type { CanvasItem, CanvasMaskSelection, CanvasLayoutMode } from "@/lib/canvas-tools";
import type { DesignCanvasNodeActions } from "@/lib/canvas-node-handlers";
import type { CanvasConnection } from "@/components/infinite-canvas/types";

export interface DesignCanvasHandle {
  fitToItem: (itemId: string) => void;
  fitToBatch: (batchId: string) => void;
  scrollToGenerating: () => void;
  pulseItem: (itemId: string) => void;
  fitAll: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  enterRefineMode: (itemId: string) => void;
  exitRefineMode: () => void;
  isInRefineMode: () => boolean;
  beginRefineJob: () => void;
  completeRefineJob: (meta?: { toolName?: string }) => void;
  cancelRefineJob: () => void;
}

export interface DesignCanvasProps {
  items: CanvasItem[];
  /** InfiniteCanvas 手动连线（持久化到 canvas_layout.infiniteConnections） */
  infiniteConnections?: CanvasConnection[];
  onInfiniteConnectionsChange?: (connections: CanvasConnection[]) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onItemsChange: (items: CanvasItem[]) => void;
  onUpload: () => void;
  onDownload: () => void;
  onDeleteSelected: () => void;
  emptyHint?: string;
  readOnly?: boolean;
  jobStreamStatus?: string | null;
  jobFailed?: boolean;
  jobErrorMessage?: string | null;
  jobProgressCompleted?: number;
  jobProgressTotal?: number;
  onOpenChatPanel?: () => void;
  selectSourceBanner?: string | null;
  /** 失败时顶部提示条可关闭 */
  showFailureBannerDismiss?: boolean;
  onDismissJobFailure?: () => void;
  /** 节点右键 / 工具链工厂（Scroll + Infinite 共用） */
  nodeActions?: DesignCanvasNodeActions;
  brushRequest?: {
    key: number;
    itemId: string;
    toolId: string;
    toolName: string;
  } | null;
  onBrushComplete?: (selection: CanvasMaskSelection) => void;
  onBrushCancel?: () => void;
  expandRequest?: {
    key: number;
    itemId: string;
    toolName: string;
    aspectPreset?: import("@/lib/expand-frame").ExpandAspectPreset;
  } | null;
  onExpandComplete?: (
    padding: import("@/lib/expand-frame").ExpandFramePadding,
    aspect: import("@/lib/expand-frame").ExpandAspectPreset,
  ) => void;
  onExpandCancel?: () => void;
  focusClickRequest?: {
    key: number;
    itemId: string;
    toolName: string;
    markers: Array<{ x: number; y: number; label: string }>;
  } | null;
  onFocusImageClick?: (
    item: CanvasItem,
    point: { x: number; y: number },
  ) => void;
  onFocusClickCancel?: () => void;
  selectionToolbar?: ReactNode;
  statusChip?: ReactNode;
  onJumpToParentBatch?: (
    parentBatchId: string,
    sourceItemId?: string,
  ) => void;
  layoutMode?: CanvasLayoutMode;
  onLayoutModeChange?: (mode: CanvasLayoutMode) => void;
  onCancelJob?: () => void;
  jobElapsedMs?: number;
  queueAhead?: number | null;
  pendingJobPrompt?: string | null;
  jobStartedAt?: number | null;
  /** 滚动画布内容区底部留白（Dock 浮层不占用画布背景高度） */
  scrollBottomInset?: string;
  /** 切换到无限画布模式（Phase C 固定 Scroll，保留 prop 供 Phase D 清理） */
  useInfiniteCanvas?: boolean;
  /** 双栏外壳：左对话 + 右产物（仅 agent 车道，scroll 模式桌面端） */
  conversationPaneEnabled?: boolean;
  /** 双栏激活状态变化通知外层（用于把底部 Dock 对齐到左对话栏） */
  onConversationPaneActiveChange?: (active: boolean) => void;
  /** 双栏左对话栏宽度（px） */
  conversationPaneWidth?: number;
  /** 双栏分隔条拖拽开始 */
  onConversationPaneResizeStart?: (event: React.MouseEvent) => void;
  /** 双栏分隔条拖拽中 */
  conversationPaneResizing?: boolean;
  /** Infinite 画布右下角控件需抬高的像素（Scroll 模式下避开全局 StudioDock） */
  overlayBottomInsetPx?: number;
  /** Infinite 画布模式激活时通知外层（用于隐藏全局底部 Dock） */
  onInfiniteCanvasActiveChange?: (active: boolean) => void;
  /** Infinite 空画布创作入口（全局 Dock 隐藏时） */
  infiniteEmptyCreation?: {
    prompt: string;
    onPromptChange: (value: string) => void;
    onSubmit: () => void;
    submitting?: boolean;
    submitLabel?: string;
  };
  /** 当前会话 ID */
  sessionId?: string;
}
