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

export async function fetchDramaProjectVersions(projectId: string) {
  const res = await request<{ data: DramaProjectVersionSummary[] }>(
    `/api/v1/drama/projects/${projectId}/versions`,
  );
  return res.data;
}


export async function fetchDramaProjectVersion(
  projectId: string,
  versionId: string,
) {
  const res = await request<{ data: DramaProjectVersionDetail }>(
    `/api/v1/drama/projects/${projectId}/versions/${versionId}`,
  );
  return res.data;
}


export async function diffDramaProjectVersions(
  projectId: string,
  versionAId: string,
  versionBId: string,
) {
  const res = await request<{ data: DramaProjectVersionDiff }>(
    `/api/v1/drama/projects/${projectId}/versions/${versionAId}/diff/${versionBId}`,
  );
  return res.data;
}


export async function restoreDramaProjectVersion(
  projectId: string,
  versionId: string,
  note?: string,
) {
  const res = await request<{ data: DramaProjectVersionDetail }>(
    `/api/v1/drama/projects/${projectId}/restore/${versionId}`,
    {
      method: "POST",
      body: JSON.stringify(note ? { note } : {}),
    },
  );
  return res.data;
}


export async function planDramaProject(body: {
  sessionId: string;
  userIdea: string;
  targetDurationSec?: number;
  aspectRatio?: "9:16" | "16:9";
  planMode?: "single" | "multi_agent";
}) {
  const res = await request<{
    data: {
      project: import("../types").DramaProject;
      estimatedPoints: number;
    };
  }>("/api/v1/drama/runs", {
    method: "POST",
    body: JSON.stringify({ ...body, autoProduce: false }),
  });
  return res.data;
}


export async function analyzeDramaReplicate(videoUrl: string) {
  const res = await request<{
    data: import("../types").DramaReplicateProfile;
  }>("/api/v1/drama/replicate/analyze", {
    method: "POST",
    body: JSON.stringify({ videoUrl }),
  });
  return res.data;
}


export async function createDramaPlanRun(body: {
  sessionId: string;
  userIdea: string;
  targetDurationSec?: number;
  aspectRatio?: "9:16" | "16:9";
  autoProduce?: boolean;
  replicateProfile?: import("../types").DramaReplicateProfile;
  projectType?: import("../types").DramaProjectType;
}) {
  const res = await request<{
    data: import("../types").DramaPlanRun;
  }>("/api/v1/drama/plan/runs", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}


export async function fetchDramaPlanRun(runId: string) {
  const res = await request<{
    data: import("../types").DramaPlanRun;
  }>(`/api/v1/drama/plan/runs/${encodeURIComponent(runId)}`);
  return res.data;
}


export async function fetchDramaSessionState(sessionId: string) {
  const res = await request<{
    data: {
      sessionId: string;
      planRun?: import("../types").DramaPlanRun;
      dramaRun?: import("../types").DramaRun;
      draftProject?: import("../types").DramaProject;
    };
  }>(`/api/v1/drama/sessions/${encodeURIComponent(sessionId)}/state`);
  return res.data;
}


export async function rerunDramaPlanRun(
  runId: string,
  body: {
    fromAgent: string;
    projectPatch?: Record<string, unknown>;
  },
) {
  const res = await request<{
    data: import("../types").DramaPlanRun;
  }>(`/api/v1/drama/plan/runs/${encodeURIComponent(runId)}/rerun`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}

/** 多轮迭代：基于既有项目按自然语言指令改写，生成新版本（复用规划 SSE） */

export async function refineDramaPlan(body: {
  sessionId: string;
  projectId: string;
  instruction: string;
}) {
  const res = await request<{
    data: import("../types").DramaPlanRun;
  }>("/api/v1/drama/plan/refine", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}

/** 深拷贝短剧项目为新项目（标题追加副本） */

export async function duplicateDramaProject(projectId: string) {
  const res = await request<{ data: import("../types").DramaProject }>(
    `/api/v1/drama/projects/${encodeURIComponent(projectId)}/duplicate`,
    { method: "POST" },
  );
  return res.data;
}

/** 会话内多轮对话回合（策划线程） */

export async function listDramaPlanTurns(sessionId: string) {
  const res = await request<{ data: import("../types").DramaPlanTurn[] }>(
    `/api/v1/drama/sessions/${encodeURIComponent(sessionId)}/turns`,
  );
  return res.data;
}


export async function startDramaProduction(body: {
  sessionId: string;
  projectId: string;
  confirmed?: boolean;
}) {
  const res = await request<{ data: import("../types").DramaRun }>(
    `/api/v1/drama/projects/${encodeURIComponent(body.projectId)}/produce`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
  return res.data;
}


export async function createDramaRun(body: {
  sessionId: string;
  userIdea: string;
  targetDurationSec?: number;
  aspectRatio?: "9:16" | "16:9";
  confirmed?: boolean;
}) {
  const res = await request<{ data: import("../types").DramaRun }>(
    "/api/v1/drama/runs",
    {
      method: "POST",
      body: JSON.stringify({ ...body, autoProduce: true }),
    },
  );
  return res.data;
}


export async function fetchDramaRun(runId: string) {
  const res = await request<{ data: import("../types").DramaRun }>(
    `/api/v1/drama/runs/${encodeURIComponent(runId)}`,
  );
  return res.data;
}


export async function fetchDramaRunGraph(runId: string) {
  const res = await request<{ data: import("../types").DramaRunGraph }>(
    `/api/v1/drama/runs/${encodeURIComponent(runId)}/graph`,
  );
  return res.data;
}


export async function confirmDramaRun(runId: string) {
  const res = await request<{ data: import("../types").DramaRun }>(
    `/api/v1/drama/runs/${encodeURIComponent(runId)}/confirm`,
    { method: "POST" },
  );
  return res.data;
}


export async function cancelDramaRun(runId: string) {
  const res = await request<{ data: import("../types").DramaRun }>(
    `/api/v1/drama/runs/${encodeURIComponent(runId)}/cancel`,
    { method: "POST" },
  );
  return res.data;
}


export async function retryDramaProduction(
  runId: string,
  fromStep?: string,
) {
  const res = await request<{ data: import("../types").DramaRun }>(
    `/api/v1/drama/runs/${encodeURIComponent(runId)}/retry`,
    {
      method: "POST",
      body: JSON.stringify(fromStep ? { fromStep } : {}),
    },
  );
  return res.data;
}


export async function rerunDramaRunFromNode(
  runId: string,
  nodeId: string,
  projectPatch?: Record<string, unknown>,
) {
  const res = await request<{ data: import("../types").DramaRun }>(
    `/api/v1/drama/runs/${encodeURIComponent(runId)}/nodes/${encodeURIComponent(nodeId)}/rerun`,
    {
      method: "POST",
      body: JSON.stringify(
        projectPatch ? { projectPatch } : {},
      ),
    },
  );
  return res.data;
}


export async function retryDramaShot(
  runId: string,
  shotId: string,
  stage: "keyframe" | "video" = "keyframe",
) {
  const res = await request<{ data: import("../types").DramaRun }>(
    `/api/v1/drama/runs/${encodeURIComponent(runId)}/shots/${encodeURIComponent(shotId)}/retry`,
    {
      method: "POST",
      body: JSON.stringify({ stage }),
    },
  );
  return res.data;
}


export async function pickDramaKeyframe(
  runId: string,
  shotId: string,
  heroIndex: number,
) {
  const res = await request<{ data: import("../types").DramaRun }>(
    `/api/v1/drama/runs/${encodeURIComponent(runId)}/shots/${encodeURIComponent(shotId)}/pick-keyframe`,
    {
      method: "POST",
      body: JSON.stringify({ heroIndex }),
    },
  );
  return res.data;
}


export async function fetchDramaProject(projectId: string) {
  const res = await request<{ data: import("../types").DramaProject }>(
    `/api/v1/drama/projects/${encodeURIComponent(projectId)}`,
  );
  return res.data;
}


export async function generateDramaCharacterTurnaround(
  projectId: string,
  characterId: string,
  options?: { force?: boolean; promptOverride?: string },
) {
  const res = await request<{
    data: {
      status: "generating" | "ready";
      jobIds: string[];
      characterId: string;
      project: import("../types").DramaProject;
    };
  }>(
    `/api/v1/drama/projects/${encodeURIComponent(projectId)}/characters/${encodeURIComponent(characterId)}/turnaround`,
    {
      method: "POST",
      body: JSON.stringify(options ?? {}),
    },
  );
  return res.data;
}


export async function generateDramaSceneRef(
  projectId: string,
  sceneId: string,
  options?: { force?: boolean; promptOverride?: string },
) {
  const res = await request<{
    data: {
      status: "generating" | "ready";
      sceneId: string;
      jobId: string | null;
      project: import("../types").DramaProject;
    };
  }>(
    `/api/v1/drama/projects/${encodeURIComponent(projectId)}/scenes/${encodeURIComponent(sceneId)}/ref`,
    {
      method: "POST",
      body: JSON.stringify(options ?? {}),
    },
  );
  return res.data;
}


export async function updateDramaProjectApi(
  projectId: string,
  project: import("../types").DramaProjectPayload,
) {
  const res = await request<{ data: import("../types").DramaProject }>(
    `/api/v1/drama/projects/${encodeURIComponent(projectId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ project }),
    },
  );
  return res.data;
}


export async function fetchDramaVoices() {
  const res = await request<{ data: import("../types").DramaVoiceOption[] }>(
    "/api/v1/drama/voices",
  );
  return res.data;
}


export async function estimateDramaPoints(query?: {
  shotCount?: number;
  charCount?: number;
  sceneCount?: number;
  dialogueShots?: number;
  previewTier?: "low" | "full";
}) {
  const params = new URLSearchParams();
  if (query?.shotCount) params.set("shotCount", String(query.shotCount));
  if (query?.charCount) params.set("charCount", String(query.charCount));
  if (query?.sceneCount) params.set("sceneCount", String(query.sceneCount));
  if (query?.dialogueShots) params.set("dialogueShots", String(query.dialogueShots));
  if (query?.previewTier) params.set("previewTier", query.previewTier);
  const res = await request<{ data: { estimatedPoints: number } }>(
    `/api/v1/drama/estimate?${params.toString()}`,
  );
  return res.data.estimatedPoints;
}


export async function estimateDramaProjectPoints(
  project: import("../types").DramaProjectPayload,
) {
  const res = await request<{ data: { estimatedPoints: number } }>(
    "/api/v1/drama/estimate",
    {
      method: "POST",
      body: JSON.stringify({ project }),
    },
  );
  return res.data.estimatedPoints;
}


export async function updateDramaTimeline(projectId: string, timeline: import("../types").DramaTimelineTrack[]) {
  const res = await request<{ data: import("../types").DramaProject }>(
    `/api/v1/drama/projects/${encodeURIComponent(projectId)}/timeline`,
    {
      method: "PATCH",
      body: JSON.stringify({ timeline }),
    },
  );
  return res.data;
}


export async function rerenderDramaRun(runId: string) {
  const res = await request<{ data: import("../types").DramaRun }>(
    `/api/v1/drama/runs/${encodeURIComponent(runId)}/render`,
    {
      method: "POST",
    },
  );
  return res.data;
}


export type DramaTemplateCategory =
  | "short_drama"
  | "mv"
  | "tvc"
  | "custom";


export interface DramaTemplateItem {
  id: string;
  name: string;
  category: DramaTemplateCategory;
  description?: string;
  template: Record<string, unknown>;
  isPreset: boolean;
  userId?: string;
  createdAt: string;
  updatedAt: string;
}

/** 模板列表（预置 + 当前用户自建） */

export async function listDramaTemplates() {
  const res = await request<{ data: DramaTemplateItem[] }>(
    "/api/v1/drama/templates",
  );
  return res.data;
}

/** 模板详情 */

export async function getDramaTemplate(id: string) {
  const res = await request<{ data: DramaTemplateItem }>(
    `/api/v1/drama/templates/${encodeURIComponent(id)}`,
  );
  return res.data;
}

/** 保存为模板 */

export async function saveDramaTemplate(body: {
  name: string;
  category?: DramaTemplateCategory;
  description?: string;
  template: Record<string, unknown>;
}) {
  const res = await request<{ data: DramaTemplateItem }>(
    "/api/v1/drama/templates",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
  return res.data;
}

/** 一键重跑 */

export async function runDramaTemplate(
  id: string,
  body: {
    sessionId: string;
    autoProduce?: boolean;
    userIdeaOverride?: string;
  },
) {
  const res = await request<{
    data: import("../types").DramaPlanRun;
  }>(`/api/v1/drama/templates/${encodeURIComponent(id)}/run`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}

/** 删除用户自建模板 */

export async function deleteDramaTemplate(id: string) {
  const res = await request<{ data: { ok: boolean } }>(
    `/api/v1/drama/templates/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
  return res.data;
}

/** AI 音乐生成 */
