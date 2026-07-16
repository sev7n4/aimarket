import type { ReactNode } from "react";
import type { CanvasItem, CanvasMaskSelection } from "@/lib/canvas-tools";
import type { DesignCanvasNodeActions } from "@/lib/canvas-node-handlers";
import type { CanvasConnection } from "@/components/infinite-canvas/types";

export interface DesignCanvasHandle {
  fitToItem: (itemId: string) => void;
  fitToBatch: (batchId: string) => void;
  scrollToGenerating: () => void;
  pulseItem: (itemId: string) => void;
  fitAll: () => void;
}

export interface DesignCanvasProps {
  items: CanvasItem[];
  /** 手动连线（持久化到 canvas_layout.infiniteConnections，向后兼容读取） */
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
  /** 节点右键 / 工具链工厂 */
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
  onCancelJob?: () => void;
  jobElapsedMs?: number;
  queueAhead?: number | null;
  pendingJobPrompt?: string | null;
  jobStartedAt?: number | null;
  /** 滚动画布内容区底部留白（Dock 浮层不占用画布背景高度） */
  scrollBottomInset?: string;
  /** 双栏外壳：左对话 + 右产物（桌面端 scroll 模式） */
  conversationPaneEnabled?: boolean;
  /** 双栏激活状态变化通知外层（用于把底部 Dock 对齐到左对话栏） */
  onConversationPaneActiveChange?: (active: boolean) => void;
  /** 双栏左对话栏宽度（px） */
  conversationPaneWidth?: number;
  /** 双栏分隔条拖拽开始 */
  onConversationPaneResizeStart?: (event: React.MouseEvent) => void;
  /** 双栏分隔条拖拽中 */
  conversationPaneResizing?: boolean;
  /** 当前会话 ID */
  sessionId?: string;
}
