import type { RefObject, Dispatch, SetStateAction } from "react";

import type { DesignCanvasHandle } from "@/components/design-canvas";
import type {
  ToolConfirmOptions,
  ToolConfirmRequest,
} from "@/components/tool-confirm-dialog";
import type { CanvasNodeData } from "@/components/infinite-canvas/types";
import type { CanvasItem, CanvasMaskSelection, PendingBatchLineage } from "@/lib/canvas-tools";
import type { ExpandAspectPreset } from "@/lib/expand-frame";
import type { InfiniteNodeToolRequest } from "@/lib/infinite-node-tool-run";
import type { StudioTool } from "@/lib/types";

export type StudioBrushRequest = {
  key: number;
  itemId: string;
  toolId: string;
  toolName: string;
  promptExtra?: string;
};

export type StudioExpandRequest = {
  key: number;
  itemId: string;
  toolName: string;
  promptExtra?: string;
  aspectPreset?: ExpandAspectPreset;
};

export type StudioMentionItemRequest = {
  key: number;
  item: CanvasItem;
  promptSuffix?: string;
  maskSelection?: CanvasMaskSelection;
};

/** Scroll / Infinite 画布节点工具 handler 共享依赖 */
export type CanvasNodeHandlerContext = {
  sessionId: string;
  readOnly: boolean;
  user: unknown;
  tools: StudioTool[];
  canvasItems: CanvasItem[];
  canvasRef: RefObject<DesignCanvasHandle | null>;
  registerBatchLineage: (jobId: string, lineage: PendingBatchLineage) => void;
  onJobStarted: (jobId: string) => void;
  setPollingJobId: (jobId: string) => void;
  setSelectedCanvasId: (id: string | null) => void;
  onRequireLogin: () => void;
  setSelectSourceBanner: (message: string | null) => void;
  setMentionItemRequest: Dispatch<SetStateAction<StudioMentionItemRequest | null>>;
  startFocusEditMode: (
    item: CanvasItem,
    opts?: { intent?: "edit" | "replace"; promptHint?: string },
  ) => void;
};

export type UseStudioToolHandlersResult = {
  pendingToolId: string | null;
  toolConfirm: ToolConfirmRequest | null;
  toolConfirmPending: boolean;
  setToolConfirm: Dispatch<SetStateAction<ToolConfirmRequest | null>>;
  brushRequest: StudioBrushRequest | null;
  setBrushRequest: Dispatch<SetStateAction<StudioBrushRequest | null>>;
  expandRequest: StudioExpandRequest | null;
  setExpandRequest: Dispatch<SetStateAction<StudioExpandRequest | null>>;
  runSelectionTool: (tool: StudioTool, item: CanvasItem) => Promise<void>;
  runQuickToolFromCanvas: (
    item: CanvasItem,
    toolId: "cutout" | "expand",
  ) => void;
  runInfiniteNodeTool: (request: InfiniteNodeToolRequest) => Promise<void>;
  executeDirectTool: (
    tool: StudioTool,
    item: CanvasItem,
    opts: ToolConfirmOptions,
  ) => Promise<void>;
  confirmTool: (opts: ToolConfirmOptions) => Promise<void>;
};

/** DesignCanvas 节点动作工厂 props（Scroll + Infinite 共用） */
export type DesignCanvasNodeActions = {
  onCutoutItem?: (item: CanvasItem) => void;
  onExpandItem?: (item: CanvasItem) => void;
  onRerun?: (item: CanvasItem) => void;
  onDownloadItem?: (item: CanvasItem) => void;
  onShareItem?: (item: CanvasItem) => void;
  onPublishItem?: (item: CanvasItem) => void;
  onRunInfiniteNodeTool?: (request: InfiniteNodeToolRequest) => void;
  batchTools?: {
    tools: StudioTool[];
    pendingToolId?: string | null;
    onRunTool: (tool: StudioTool, item: CanvasItem) => void;
    onMentionItem?: (item: CanvasItem) => void;
    onExtractVideoLastFrame?: (item: CanvasItem) => void;
    onAddVideoBgm?: (item: CanvasItem) => void;
    videoActionBusy?: boolean;
  };
  drama?: {
    onGenerateShotImage?: (node: CanvasNodeData) => void;
    onGenerateShotVideo?: (node: CanvasNodeData) => void;
    onGenerateCharacterSheet?: (node: CanvasNodeData) => void;
    onGenerateShotsFromScript?: (node: CanvasNodeData) => void;
  };
};
