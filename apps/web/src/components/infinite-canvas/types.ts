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
  batchIndex?: number;
  batchChildIds?: string[];
  primaryImageId?: string;
  imageBatchExpanded?: boolean;
  storageKey?: string;
  mimeType?: string;
  bytes?: number;
  durationMs?: number;
  // ── Drama node metadata ──
  // Script node
  scriptTitle?: string;
  logline?: string;
  actCount?: number;
  narratorLineCount?: number;
  // Shot node
  shotOrder?: number;
  sceneId?: string;
  characterIds?: string[];
  dialogue?: string;
  visualPrompt?: string;
  motionPrompt?: string;
  cameraShotSize?: string;
  cameraMovement?: string;
  cameraLighting?: string;
  durationSec?: number;
  shotStatus?: "pending" | "keyframe" | "video" | "audio" | "done" | "failed";
  keyframeOutputId?: string;
  keyframeVariantUrls?: string[];
  keyframeHeroIndex?: number;
  videoOutputId?: string;
  // Character node
  characterName?: string;
  characterRole?: string;
  personalityTone?: string;
  promptAnchor?: string;
  turnaroundStatus?: "draft" | "locked";
  refUrl?: string;
  // Scene node
  sceneName?: string;
  location?: string;
  atmosphere?: string;
  era?: string;
  scenePromptAnchor?: string;
  sceneRefUrl?: string;
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
    }
  | {
      type: "pane";
      x: number;
      y: number;
      worldX: number;
      worldY: number;
    };
