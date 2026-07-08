import type { ReactNode } from "react";
import type { CanvasItem, CanvasMaskSelection, CanvasLayoutMode } from "@/lib/canvas-tools";
import type { DramaStudioViewPhase } from "@/lib/drama-studio-view";
import type { DesignCanvasNodeActions } from "@/lib/canvas-node-handlers";
import type { CanvasNodeData, CanvasConnection } from "@/components/infinite-canvas/types";
import type { CanvasAgentSnapshot, CanvasAgentOp, AgentExternalAction } from "@/components/infinite-canvas/utils";
import type { OrchestrationTimelineActions, OrchestrationTimelineEvent } from "@/lib/canvas-timeline";

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
  dramaNodePositions?: Record<string, { x: number; y: number }>;
  onDramaNodePositionsChange?: (
    positions: Record<string, { x: number; y: number }>,
  ) => void;
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
  orchestrationEvent?: import("@/lib/canvas-timeline").OrchestrationTimelineEvent | null;
  orchestrationActions?: import("@/lib/canvas-timeline").OrchestrationTimelineActions;
  orchestrationExtra?: React.ReactNode;
  /** 制片模式等：替换滚动画布主区（仍可在下方展示 orchestrationExtra） */
  alternateCanvasContent?: ReactNode;
  /** 切换到无限画布模式（Phase 1 默认 false，Phase 2 默认 true） */
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
  /** 「节点视图 ↔ 滚动视图」切换开关是否可用（三车道一致） */
  canvasViewEnabled?: boolean;
  /** 制片模式：Infinite 下叠加短剧节点编排面板 */
  dramaPhaseSplitEnabled?: boolean;
  dramaViewPhase?: DramaStudioViewPhase;
  onDramaViewPhaseChange?: (phase: DramaStudioViewPhase) => void;
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
  /** Drama 专用画布节点（由 dramaPlanToCanvasNodes 生成，叠加到 InfiniteCanvas 上） */
  dramaNodes?: CanvasNodeData[];
  /** Drama 节点间连线 */
  dramaConnections?: CanvasConnection[];
  /** Agent 对话面板快照（用于 CanvasAssistantPanel） */
  assistantSnapshot?: CanvasAgentSnapshot | null;
  /** Agent 应用 Ops 时的回调（Drama 草稿写回） */
  onApplyAssistantOps?: (ops: CanvasAgentOp[]) => void;
  /** 制片草稿存在时展示 Drama 类节点创建项 */
  allowDramaNodeCreate?: boolean;
  /** Agent 外部动作（规划/制作/生成）回调，由 Studio 对接 API */
  onAgentExternalAction?: (action: AgentExternalAction) => void;
  /** 当前会话 ID（用于 TemplateManager 一键重跑） */
  sessionId?: string;
  /** Phase 4.3：模板重跑启动（planRunId + 模板 payload，用于节点布局还原） */
  onTemplatePlanRunStarted?: (
    planRunId: string,
    template: Record<string, unknown>,
  ) => void;
  /** Phase 4：更新 Drama 分镜节点摄影参数（不触发重新生成） */
  onPatchDramaShotNode?: (
    nodeId: string,
    patch: {
      cameraShotSize?: string;
      cameraMovement?: string;
      cameraLighting?: string;
      visualPrompt?: string;
    },
  ) => void;
  /** NeoWOW 式 /workflow 壳：左画布 + 右 Agent 分栏 */
  workflowShell?: boolean;
}

