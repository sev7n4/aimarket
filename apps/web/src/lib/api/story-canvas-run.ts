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

export async function storyCanvasRunByEndpoint(
  endpoint:
    | "generate-image"
    | "generate-video"
    | "outpainting"
    | "upscale-image"
    | "lighting"
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
  return postWorkflowRun(endpoint, body);
}
