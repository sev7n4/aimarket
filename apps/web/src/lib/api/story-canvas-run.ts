import { request } from "./core";
import {
  storyCanvasGenerateImage,
  storyCanvasGenerateVideo,
  type WorkflowGenerateResponse,
} from "./story-canvas";

export type WorkflowRunRequest = {
  sessionId: string;
  nodeKey: string;
  prompt: string;
  workflowToolType?: string;
  referenceUrls?: string[];
  videoUrl?: string;
  audioUrl?: string;
  shotSize?: string;
  movement?: string;
  pitch?: number;
  yaw?: number;
};

async function postWorkflowRun(
  endpoint: string,
  body: WorkflowRunRequest,
): Promise<WorkflowGenerateResponse> {
  const res = await request<{ data: WorkflowGenerateResponse }>(
    `/api/v1/story-canvas/${endpoint}`,
    { method: "POST", body: JSON.stringify(body) },
  );
  return res.data;
}

export function storyCanvasRunOutpainting(body: WorkflowRunRequest) {
  return postWorkflowRun("outpainting", body);
}

export function storyCanvasRunUpscale(body: WorkflowRunRequest) {
  return postWorkflowRun("upscale-image", body);
}

export function storyCanvasRunLighting(body: WorkflowRunRequest) {
  return postWorkflowRun("lighting", body);
}

export function storyCanvasRunMusic(body: WorkflowRunRequest) {
  return postWorkflowRun("generate-music", {
    ...body,
    prompt: body.prompt,
  });
}

export function storyCanvasRunAudio(body: WorkflowRunRequest) {
  return postWorkflowRun("generate-audio", body);
}

export function storyCanvasRunLipSync(body: WorkflowRunRequest) {
  return postWorkflowRun("lip-sync", body);
}

export function storyCanvasRunPoseReference(body: WorkflowRunRequest) {
  return postWorkflowRun("pose-reference", body);
}

export function storyCanvasRunMotionControl(body: WorkflowRunRequest) {
  return postWorkflowRun("motion-control", body);
}

export async function storyCanvasRunByEndpoint(
  endpoint:
    | "generate-image"
    | "generate-video"
    | "outpainting"
    | "upscale-image"
    | "lighting"
    | "lip-sync"
    | "pose-reference"
    | "motion-control"
    | "generate-music"
    | "generate-audio",
  body: WorkflowRunRequest,
): Promise<WorkflowGenerateResponse> {
  if (endpoint === "generate-video") {
    return storyCanvasGenerateVideo(body);
  }
  if (endpoint === "generate-image") {
    return storyCanvasGenerateImage(body);
  }
  if (endpoint === "lip-sync") {
    return storyCanvasRunLipSync(body);
  }
  if (endpoint === "pose-reference") {
    return storyCanvasRunPoseReference(body);
  }
  if (endpoint === "motion-control") {
    return storyCanvasRunMotionControl(body);
  }
  return postWorkflowRun(endpoint, body);
}
