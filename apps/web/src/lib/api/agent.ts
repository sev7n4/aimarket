import { request, getToken, setToken, assetUrl } from "./core";
import type {
  ApiErrorBody,
  ApiUser,
  ChatMessage,
  CreditPackage,
  GenerationJob,
  ImageModel,
  ImageSession,
  InspirationDetail,
  InspirationListItem,
  InviteInfo,
  PublicSharePayload,
  SessionShareStatus,
  Notice,
  ProductSetInit,
  RouteSuggestion,
  SessionAccessMeta,
  SessionReference,
  SignStatus,
  StudioTool,
  VideoModelRouteMeta,
  WorkspaceReview,
  WorkspaceReviewComment,
  DramaProjectVersionDetail,
  DramaProjectVersionDiff,
  DramaProjectVersionSummary,
} from "../types";

export async function fetchAgentPlan(body: {
  prompt: string;
  mode: string;
  modelId?: string;
  resolution?: string;
  aspectRatio?: string;
  count?: number;
}) {
  const res = await request<{ data: import("../types").AgentPlan }>(
    "/api/v1/agent/plan",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
  return res.data;
}


export async function createAgentRun(body: {
  sessionId: string;
  prompt: string;
  mode: "chat" | "image" | "ecommerce";
  modelId?: string;
  resolution?: string;
  aspectRatio?: string;
  count?: number;
}) {
  const res = await request<{ data: import("../types").AgentRun }>(
    "/api/v1/agent/runs",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
  return res.data;
}


export async function fetchAgentRun(runId: string) {
  const res = await request<{ data: import("../types").AgentRun }>(
    `/api/v1/agent/runs/${encodeURIComponent(runId)}`,
  );
  return res.data;
}


export async function confirmAgentRun(runId: string) {
  const res = await request<{ data: import("../types").AgentRun }>(
    `/api/v1/agent/runs/${encodeURIComponent(runId)}/confirm`,
    { method: "POST" },
  );
  return res.data;
}


export async function cancelAgentRun(runId: string) {
  const res = await request<{ data: import("../types").AgentRun }>(
    `/api/v1/agent/runs/${encodeURIComponent(runId)}/cancel`,
    { method: "POST" },
  );
  return res.data;
}


export async function fetchAgentSkills() {
  const res = await request<{ data: import("../types").AgentSkillPublic[] }>(
    "/api/v1/agent/skills",
  );
  return res.data;
}


export async function createSkillRun(
  skillId: string,
  body: {
    sessionId: string;
    prompt: string;
    productAssetId?: string;
    referenceAssetId?: string;
    confirmed?: boolean;
  },
) {
  const res = await request<{ data: import("../types").SkillRun }>(
    `/api/v1/agent/skills/${encodeURIComponent(skillId)}/runs`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
  return res.data;
}


export async function fetchSkillRun(runId: string) {
  const res = await request<{ data: import("../types").SkillRun }>(
    `/api/v1/agent/skills/runs/${encodeURIComponent(runId)}`,
  );
  return res.data;
}


export async function confirmSkillRun(runId: string) {
  const res = await request<{ data: import("../types").SkillRun }>(
    `/api/v1/agent/skills/runs/${encodeURIComponent(runId)}/confirm`,
    { method: "POST" },
  );
  return res.data;
}


export async function cancelSkillRun(runId: string) {
  const res = await request<{ data: import("../types").SkillRun }>(
    `/api/v1/agent/skills/runs/${encodeURIComponent(runId)}/cancel`,
    { method: "POST" },
  );
  return res.data;
}

