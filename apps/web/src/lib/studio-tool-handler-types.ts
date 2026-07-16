import type { RefObject, Dispatch, SetStateAction } from "react";
import type { CreationMode } from "@aimarket/ui";

import type { DesignCanvasHandle } from "@/components/design-canvas";
import type {
  ToolConfirmOptions,
  ToolConfirmRequest,
} from "@/components/tool-confirm-dialog";
import type { CanvasItem, CanvasMaskSelection, PendingBatchLineage } from "@/lib/canvas-tools";
import type { StudioTool } from "@/lib/types";

export type StudioMentionItemRequest = {
  key: number;
  item: CanvasItem;
  promptSuffix?: string;
  maskSelection?: CanvasMaskSelection;
};

/** Scroll 画布工具 handler 共享依赖 */
export type CanvasNodeHandlerContext = {
  sessionId: string;
  mode: CreationMode;
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
  runSelectionTool: (tool: StudioTool, item: CanvasItem) => Promise<void>;
  runQuickToolFromCanvas: (item: CanvasItem, toolId: "cutout") => void;
  executeDirectTool: (
    tool: StudioTool,
    item: CanvasItem,
    opts: ToolConfirmOptions,
  ) => Promise<void>;
  confirmTool: (opts: ToolConfirmOptions) => Promise<void>;
};

/** DesignCanvas 节点动作工厂 props（Scroll） */
export type DesignCanvasNodeActions = {
  onCutoutItem?: (item: CanvasItem) => void;
  onRerun?: (item: CanvasItem) => void;
  onDownloadItem?: (item: CanvasItem) => void;
  onShareItem?: (item: CanvasItem) => void;
  onPublishItem?: (item: CanvasItem) => void;
  batchTools?: {
    tools: StudioTool[];
    pendingToolId?: string | null;
    onRunTool: (tool: StudioTool, item: CanvasItem) => void;
    onMentionItem?: (item: CanvasItem) => void;
    onExtractVideoLastFrame?: (item: CanvasItem) => void;
    onAddVideoBgm?: (item: CanvasItem) => void;
    videoActionBusy?: boolean;
  };
};
