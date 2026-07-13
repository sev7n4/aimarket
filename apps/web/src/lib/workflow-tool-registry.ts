import { randomUUID } from "@/lib/uuid";
import {
  CanvasNodeType,
  type CanvasNodeMetadata,
} from "@/components/infinite-canvas/types";
import type { CanvasAgentOp } from "@/components/infinite-canvas/utils";

/** 对标 NeoWOW story-canvas 节点工具类型（Phase 2 高频子集） */
export const WORKFLOW_TOOL_IDS = [
  "TEXT_TO_IMAGE",
  "IMAGE_TO_IMAGE",
  "TEXT_TO_VIDEO",
  "IMAGE_TO_VIDEO",
  "IMAGE_OUTPAINTING",
  "IMAGE_UPSCALE",
  "LIGHTING_MODIFICATION",
  "POSE_REFERENCE",
  "MOTION_CONTROL",
  "LIP_SYNC",
  "MUSIC_GENERATION",
  "AUDIO_GENERATION",
] as const;

export type WorkflowToolId = (typeof WORKFLOW_TOOL_IDS)[number];

export type WorkflowToolCategory = "generate" | "edit" | "audio";

export type WorkflowMediaKind = "image" | "video" | "audio" | "text";

export type WorkflowToolDefinition = {
  id: WorkflowToolId;
  label: string;
  description: string;
  category: WorkflowToolCategory;
  canvasNodeType: CanvasNodeType;
  generationMode?: CanvasNodeMetadata["generationMode"];
  /** 节点产出的媒体类型（连线 source 侧） */
  outputKind?: WorkflowMediaKind;
  /** 可接受的输入媒体类型（连线 target 侧） */
  inputKinds?: WorkflowMediaKind[];
  /** 映射到现有 Studio /tools API（如有） */
  studioToolId?: string;
};

export const WORKFLOW_TOOL_CATEGORY_LABELS: Record<WorkflowToolCategory, string> =
  {
    generate: "生成",
    edit: "编辑",
    audio: "音频",
  };

const WORKFLOW_TOOLS: WorkflowToolDefinition[] = [
  {
    id: "TEXT_TO_IMAGE",
    label: "文生图",
    description: "根据文本描述生成图片",
    category: "generate",
    canvasNodeType: CanvasNodeType.Image,
    generationMode: "image",
    outputKind: "image",
    inputKinds: ["text"],
  },
  {
    id: "IMAGE_TO_IMAGE",
    label: "图生图",
    description: "基于参考图生成新图片",
    category: "generate",
    canvasNodeType: CanvasNodeType.Image,
    generationMode: "image",
    outputKind: "image",
    inputKinds: ["image"],
  },
  {
    id: "TEXT_TO_VIDEO",
    label: "文生视频",
    description: "根据文本描述生成视频",
    category: "generate",
    canvasNodeType: CanvasNodeType.Video,
    generationMode: "video",
    outputKind: "video",
    inputKinds: ["text"],
  },
  {
    id: "IMAGE_TO_VIDEO",
    label: "图生视频",
    description: "基于图片生成视频",
    category: "generate",
    canvasNodeType: CanvasNodeType.Video,
    generationMode: "video",
    outputKind: "video",
    inputKinds: ["image"],
  },
  {
    id: "IMAGE_OUTPAINTING",
    label: "扩图",
    description: "向外扩展画面边界",
    category: "edit",
    canvasNodeType: CanvasNodeType.Image,
    generationMode: "image",
    outputKind: "image",
    inputKinds: ["image"],
    studioToolId: "expand",
  },
  {
    id: "IMAGE_UPSCALE",
    label: "图片高清",
    description: "提升图片分辨率",
    category: "edit",
    canvasNodeType: CanvasNodeType.Image,
    generationMode: "image",
    outputKind: "image",
    inputKinds: ["image"],
  },
  {
    id: "LIGHTING_MODIFICATION",
    label: "高级打光",
    description: "调整画面光照氛围",
    category: "edit",
    canvasNodeType: CanvasNodeType.Image,
    generationMode: "image",
    outputKind: "image",
    inputKinds: ["image"],
  },
  {
    id: "POSE_REFERENCE",
    label: "姿势参考",
    description: "按参考图生成一致角色姿态",
    category: "edit",
    canvasNodeType: CanvasNodeType.Image,
    generationMode: "image",
    outputKind: "image",
    inputKinds: ["image"],
  },
  {
    id: "MOTION_CONTROL",
    label: "运镜控制",
    description: "按运镜参数生成视频",
    category: "edit",
    canvasNodeType: CanvasNodeType.Video,
    generationMode: "video",
    outputKind: "video",
    inputKinds: ["image", "video"],
    studioToolId: "camera-control",
  },
  {
    id: "LIP_SYNC",
    label: "口型同步",
    description: "视频与音频口型对齐",
    category: "edit",
    canvasNodeType: CanvasNodeType.Video,
    generationMode: "video",
    outputKind: "video",
    inputKinds: ["video", "audio"],
    studioToolId: "lipsync",
  },
  {
    id: "MUSIC_GENERATION",
    label: "音乐生成",
    description: "生成背景音乐",
    category: "audio",
    canvasNodeType: CanvasNodeType.Audio,
    generationMode: "audio",
    outputKind: "audio",
    inputKinds: ["text"],
  },
  {
    id: "AUDIO_GENERATION",
    label: "语音生成",
    description: "文本转语音",
    category: "audio",
    canvasNodeType: CanvasNodeType.Audio,
    generationMode: "audio",
    outputKind: "audio",
    inputKinds: ["text"],
  },
];

const TOOL_BY_ID = new Map(WORKFLOW_TOOLS.map((tool) => [tool.id, tool]));

export function listWorkflowTools(): WorkflowToolDefinition[] {
  return WORKFLOW_TOOLS;
}

export function getWorkflowTool(id: WorkflowToolId): WorkflowToolDefinition | undefined {
  return TOOL_BY_ID.get(id);
}

export function listWorkflowToolsByCategory(): {
  category: WorkflowToolCategory;
  label: string;
  tools: WorkflowToolDefinition[];
}[] {
  const order: WorkflowToolCategory[] = ["generate", "edit", "audio"];
  return order.map((category) => ({
    category,
    label: WORKFLOW_TOOL_CATEGORY_LABELS[category],
    tools: WORKFLOW_TOOLS.filter((tool) => tool.category === category),
  }));
}

export function isWorkflowToolId(value: string): value is WorkflowToolId {
  return (WORKFLOW_TOOL_IDS as readonly string[]).includes(value);
}

export function buildWorkflowToolNodeOp(
  tool: WorkflowToolDefinition,
  worldX: number,
  worldY: number,
): CanvasAgentOp {
  const metadata: CanvasNodeMetadata = {
    status: "idle",
    workflowToolType: tool.id,
    ...(tool.generationMode ? { generationMode: tool.generationMode } : {}),
  };
  return {
    type: "add_node",
    id: `wf-${tool.id.toLowerCase()}-${randomUUID()}`,
    nodeType: tool.canvasNodeType,
    title: tool.label,
    x: worldX,
    y: worldY,
    metadata,
  };
}
