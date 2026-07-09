import { request } from "./core";

export type WorkflowGenerateResponse = {
  nodeKey: string;
  jobId: string;
  status: "pending";
  pointsCost: number;
};

export type WorkflowNodeStatus = {
  status: string;
  jobId?: string;
  outputUrl?: string;
  error?: string;
};

export async function storyCanvasGenerateImage(body: {
  sessionId: string;
  nodeKey: string;
  prompt: string;
  workflowToolType?: string;
  referenceUrls?: string[];
}) {
  const res = await request<{ data: WorkflowGenerateResponse }>(
    "/api/v1/story-canvas/generate-image",
    { method: "POST", body: JSON.stringify(body) },
  );
  return res.data;
}

export async function storyCanvasGenerateVideo(body: {
  sessionId: string;
  nodeKey: string;
  prompt: string;
  workflowToolType?: string;
  referenceUrls?: string[];
}) {
  const res = await request<{ data: WorkflowGenerateResponse }>(
    "/api/v1/story-canvas/generate-video",
    { method: "POST", body: JSON.stringify(body) },
  );
  return res.data;
}

export async function storyCanvasBatchQueryStatus(
  sessionId: string,
  nodeKeys: string[],
) {
  const params = new URLSearchParams({
    sessionId,
    nodeKeys: nodeKeys.join(","),
  });
  const res = await request<{ data: Record<string, WorkflowNodeStatus> }>(
    `/api/v1/story-canvas/batch-query-status?${params.toString()}`,
  );
  return res.data;
}
