import type { RefObject, Dispatch, SetStateAction } from "react";

import type { DesignCanvasHandle } from "@/components/design-canvas";
import type {
  ToolConfirmOptions,
  ToolConfirmRequest,
} from "@/components/tool-confirm-dialog";
import type { CanvasItem, CanvasMaskSelection, PendingBatchLineage } from "@/lib/canvas-tools";
import type { ExpandAspectPreset } from "@/lib/expand-frame";
import { expandFromDirection } from "@/lib/expand-extend";
import type { InfiniteNodeToolRequest } from "@/lib/infinite-node-tool-run";
import {
  resolveNodeToolPrompt,
  resolveNodeToolReferences,
} from "@/lib/infinite-node-tool-run";
import { runTool, trackEvent } from "@/lib/api-client";
import { hapticLight } from "@/lib/haptics";
import { resolveToolResolution } from "@/lib/tool-resolution";
import {
  buildToolPromptSuffix,
  getToolInteraction,
} from "@/lib/studio-tool-interaction";
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
