import { CanvasNodeType } from "@/components/infinite-canvas/types";
import { isWorkflowToolId, type WorkflowToolId } from "@/lib/workflow-tool-registry";

export type WorkflowRunEndpoint =
  | "generate-image"
  | "generate-video"
  | "outpainting"
  | "upscale-image"
  | "lighting"
  | "generate-music"
  | "generate-audio";

const TOOL_ENDPOINT_MAP: Partial<Record<WorkflowToolId, WorkflowRunEndpoint>> = {
  TEXT_TO_VIDEO: "generate-video",
  IMAGE_TO_VIDEO: "generate-video",
  IMAGE_OUTPAINTING: "outpainting",
  IMAGE_UPSCALE: "upscale-image",
  LIGHTING_MODIFICATION: "lighting",
  MUSIC_GENERATION: "generate-music",
  AUDIO_GENERATION: "generate-audio",
};

export function resolveWorkflowRunEndpoint(input: {
  workflowToolType?: string;
  nodeType: CanvasNodeType;
}): WorkflowRunEndpoint {
  const toolType = input.workflowToolType;
  if (toolType && isWorkflowToolId(toolType)) {
    const mapped = TOOL_ENDPOINT_MAP[toolType];
    if (mapped) return mapped;
  }
  if (input.nodeType === CanvasNodeType.Video) return "generate-video";
  return "generate-image";
}

export function workflowRunRequiresReference(workflowToolType?: string): boolean {
  return (
    workflowToolType === "IMAGE_OUTPAINTING" ||
    workflowToolType === "IMAGE_UPSCALE" ||
    workflowToolType === "LIGHTING_MODIFICATION" ||
    workflowToolType === "IMAGE_TO_IMAGE" ||
    workflowToolType === "IMAGE_TO_VIDEO"
  );
}
