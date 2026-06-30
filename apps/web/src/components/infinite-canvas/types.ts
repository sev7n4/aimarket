export type Position = {
  x: number;
  y: number;
};

export type ViewportTransform = {
  x: number;
  y: number;
  k: number;
};

export enum CanvasNodeType {
  Image = "image",
  Text = "text",
  Config = "config",
  Video = "video",
  Audio = "audio",
  // Phase 2 Drama extension
  Script = "script",
  Shot = "shot",
  Character = "character",
  Scene = "scene",
}

export type CanvasNodeStatus = "idle" | "success" | "loading" | "error";

export type CanvasNodeMetadata = {
  content?: string;
  prompt?: string;
  status?: CanvasNodeStatus;
  errorDetails?: string;
  fontSize?: number;
  generationMode?: "text" | "image" | "video" | "audio";
  naturalWidth?: number;
  naturalHeight?: number;
  freeResize?: boolean;
  isBatchRoot?: boolean;
  batchRootId?: string;
  batchChildIds?: string[];
  primaryImageId?: string;
  imageBatchExpanded?: boolean;
  storageKey?: string;
  mimeType?: string;
  bytes?: number;
  durationMs?: number;
  // Phase 2 Drama extension placeholders
  // scriptTitle?: string;
  // logline?: string;
  // acts?: ...
  // shotDialogue?: string;
  // visualPrompt?: string;
  // characterVisualSignature?: string;
  // sceneLocation?: string;
  // atmosphere?: string;
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

export type ConnectionHandle = {
  nodeId: string;
  handleType: "source" | "target";
};

export type SelectionBox = {
  startWorldX: number;
  startWorldY: number;
  currentWorldX: number;
  currentWorldY: number;
  additive: boolean;
  initialSelectedNodeIds: string[];
};

export type ContextMenuState =
  | {
      type: "node";
      x: number;
      y: number;
      nodeId: string;
    }
  | {
      type: "connection";
      x: number;
      y: number;
      connectionId: string;
    };
