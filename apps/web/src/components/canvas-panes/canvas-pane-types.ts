import type { ReactNode, RefObject } from "react";

import type { CanvasItem } from "@/lib/canvas-tools";
import type {
  CanvasAgentSnapshot,
  CanvasAgentOp,
} from "@/components/infinite-canvas/utils";
import type {
  CanvasConnection,
  CanvasNodeData,
  ContextMenuState,
  ViewportTransform,
} from "@/components/infinite-canvas/types";
import type {
  OrchestrationTimelineActions,
  OrchestrationTimelineEvent,
} from "@/lib/canvas-timeline";

/** 三 Pane 共享基础 props */
export type CanvasPaneBaseProps = {
  readOnly?: boolean;
  items: CanvasItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

export type InfiniteCanvasEmptyCreation = {
  prompt: string;
  onPromptChange: (value: string) => void;
  onSubmit: () => void;
  submitting?: boolean;
  submitLabel?: string;
};

export type InfiniteCanvasJobOverlayProps = {
  show: boolean;
  failed: boolean;
  status: string | null;
  errorMessage?: string | null;
  completed: number;
  total: number;
  elapsedMs?: number;
  queueAhead?: number | null;
  onOpenChat?: () => void;
  onCancel?: () => void;
  onDismissFailure?: () => void;
};

/** Infinite 画布 Pane（P3-2 从 design-canvas 迁出） */
export type InfiniteCanvasPaneProps = CanvasPaneBaseProps & {
  areaRef: RefObject<HTMLDivElement | null>;
  nodes: CanvasNodeData[];
  connections: CanvasConnection[];
  viewport: ViewportTransform;
  selectedNodeIds: string[];
  selectedConnectionId?: string | null;
  onSelectedConnectionChange?: (connectionId: string | null) => void;
  onDeleteConnection?: (connectionId: string) => void;
  onTitleChange?: (nodeId: string, title: string) => void;
  overlayBottomInsetPx: number;
  jobOverlay: InfiniteCanvasJobOverlayProps;
  renderNodeStudioPanel?: (node: CanvasNodeData) => ReactNode;
  onNodesChange: (nodes: CanvasNodeData[]) => void;
  onConnectionsChange: (connections: CanvasConnection[]) => void;
  onViewportChange: (viewport: ViewportTransform) => void;
  onSelectionChange: (ids: string[]) => void;
  onNodeDoubleClick: (nodeId: string) => void;
  onConnectionCreateClick: (event: React.MouseEvent, nodeId: string) => void;
  onConnectionDropAtEmpty?: (params: {
    fromNodeId: string;
    handleType: "source" | "target";
    world: { x: number; y: number };
    client: { x: number; y: number };
  }) => void;
  onCanvasDoubleClick: (
    world: { x: number; y: number },
    client: { x: number; y: number },
  ) => void;
  onContextMenu: (state: ContextMenuState | null) => void;
  showEmptyPrompt: boolean;
  emptyCreation?: InfiniteCanvasEmptyCreation;
  onOpenCenterCreateMenu: () => void;
  onNodeCreateToggleClick: (anchor: DOMRect) => void;
  showTemplateManager: boolean;
  onToggleTemplateManager: () => void;
  showMusicGenPanel: boolean;
  onToggleMusicGenPanel: () => void;
  dramaPanelNode: CanvasNodeData | null;
  showDramaPropertyPanel: boolean;
  onCloseDramaPanel: () => void;
  assistantSnapshot: CanvasAgentSnapshot | null;
  showAssistantPanel: boolean;
  onApplyAssistantOps: (ops: CanvasAgentOp[]) => CanvasAgentSnapshot;
  /** NeoWOW workflow 壳：右栏 Agent 分栏 + 可拖拽调宽 */
  workflowShell?: boolean;
  onAddWorkflowTool?: (
    toolId: import("@/lib/workflow-tool-registry").WorkflowToolId,
  ) => void;
  onApplyAsset?: (itemId: string) => void;
  onAssetDropAt?: (itemId: string, world: { x: number; y: number }) => void;
  agentPanelWidth?: number;
  agentPanelDragging?: boolean;
  onAgentPanelResizeStart?: (event: React.MouseEvent) => void;
  templateSelectedNodes: CanvasNodeData[];
  templateSelectedConnections: CanvasConnection[];
  sessionId?: string;
  onTemplatePlanRunStarted?: (
    planRunId: string,
    template: Record<string, unknown>,
  ) => void;
  onCloseTemplateManager: () => void;
  onCloseMusicGenPanel: () => void;
  infiniteOrchestrationDock: boolean;
  legacyInfiniteOrchestrationDock: boolean;
  alternateCanvasContent?: ReactNode;
  orchestrationEvent?: OrchestrationTimelineEvent | null;
  orchestrationActions?: OrchestrationTimelineActions;
  orchestrationExtra?: ReactNode;
  onMediaUploadAt?: (files: File[], world: { x: number; y: number }) => void;
  multiSelectActions?: {
    onGroup: () => void;
    onLayout: () => void;
    onDownload: () => void;
    onDelete: () => void;
    onBatchConnect: (targetNodeId: string) => void;
  };
  multiSelectNotice?: string | null;
};

/** Scroll 画布 Pane（P3-3）— 见 ScrollCanvasPane.tsx */
export type { ScrollCanvasPaneProps } from "./ScrollCanvasPane";

/** Free / Refine 画布 Pane（P3-4）— 见 FreeCanvasPane.tsx */
export type { FreeCanvasPaneProps } from "./FreeCanvasPane";
