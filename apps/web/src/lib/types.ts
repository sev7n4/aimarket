export interface InspirationListItem {
  id: string;
  title: string;
  category: string;
  coverUrl: string;
  aspectRatio?: string;
  mediaType?: "image" | "video";
  /** 视频灵感：悬停预览用，封面 coverUrl 为 poster 图 */
  videoUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InspirationDetail {
  id: string;
  title: string;
  category: string;
  prompt: string;
  promptTemplate?: string;
  variables?: Array<{ key: string; label: string; default: string }>;
  modelId: string;
  aspectRatio: string;
  resolution: string;
  coverUrl: string;
  referenceAssets: Array<{ url: string; fileName?: string; assetId?: string }>;
  /** 由 modelId 解析：图片灵感走图片车道，视频灵感走视频车道 */
  mediaType?: "image" | "video";
  videoUrl?: string;
}

export interface ApiUser {
  id: string;
  email: string;
  credits: number;
  pending_credits?: number;
  email_verified?: boolean;
  created_at?: string;
  phone?: string;
}

export interface ImageSession {
  id: string;
  title: string;
  mode: string;
  kind?: "canvas" | "project";
  status: string;
  updated_at: string;
  user_id?: string;
  creator_email?: string | null;
  can_edit?: boolean;
  is_read_only?: boolean;
}

export interface SessionAccessMeta {
  can_edit?: boolean;
  is_read_only?: boolean;
}

export interface MessageOutput {
  id?: string;
  url: string;
  thumbUrl?: string;
  sort_order: number;
  label?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  job_id: string | null;
  created_at: string;
  parent_job_id?: string;
  source_output_id?: string;
  outputs: MessageOutput[];
  generation_params?: {
    prompt: string;
    modelId?: string;
    resolution?: string;
    aspectRatio?: string;
    count?: number;
    toolType?: string;
    imageProvider?: string;
    /** 创作台 Auto 提交；旧 job 兼容 */
    autoRoute?: boolean;
    routingMode?: "auto" | "explicit" | "byok";
    qualityTier?: "standard" | "pro";
    sourceLane?: "agent" | "image" | "video";
  };
}

export interface ImageModel {
  id: string;
  name: string;
  description: string;
  type: string;
  pointsFactor: number;
}

/** queryModels.meta.videoRoutes 单项 */
export type VideoReferenceCapability =
  | "full"
  | "image-only"
  | "first-only"
  | "degraded"
  | "none";

export interface VideoModelCapabilities {
  omni: VideoReferenceCapability;
  firstLast: VideoReferenceCapability;
  smartMultiFrame: VideoReferenceCapability;
}

export interface VideoModelRouteMeta {
  modelId: string;
  modelName: string;
  provider: string;
  available: boolean;
  upstreamLabel: string;
  routingHint?: string;
  unavailableReason?: string;
  capabilities?: VideoModelCapabilities;
}

export interface GenerationJob {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  points_cost: number;
  error: string | null;
  count?: number;
  tool_type?: string | null;
  image_provider?: string | null;
  queue_ahead?: number | null;
  outputs: { url: string; sort_order: number }[];
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}

export interface SessionReference {
  id: string;
  url: string;
  label: string;
  createdAt: string;
}

export interface RouteSuggestion {
  modelId: string;
  reason: string;
}

export interface AgentPlanStep {
  type: "generate" | "tool" | "video";
  toolId?: string;
  label: string;
  prompt?: string;
}

export interface AgentPlan {
  intent: string;
  modelId: string;
  mode: string;
  resolution: string;
  aspectRatio: string;
  count: number;
  steps: AgentPlanStep[];
  estimatedPoints: number;
  requiresConfirm: boolean;
  reason: string;
  planSource?: "llm" | "rule";
  skillId?: string;
}

export type AgentRunStatus =
  | "planning"
  | "waiting_confirm"
  | "running"
  | "waiting_job"
  | "completed"
  | "failed"
  | "cancelled";

export interface AgentJobObservation {
  jobId: string;
  status: "succeeded" | "failed";
  outputIds: string[];
  urls: string[];
  error?: string;
  pointsCost?: number;
  provider?: string;
}

export interface AgentRun {
  id: string;
  sessionId: string;
  status: AgentRunStatus;
  prompt: string;
  mode: string;
  plan: AgentPlan | null;
  currentStepIndex: number;
  pendingJobId: string | null;
  planSource: string | null;
  skillId: string | null;
  error: string | null;
  observations: AgentJobObservation[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentSkillPublic {
  id: string;
  version: number;
  name: string;
  description?: string;
  stepCount: number;
  confirmIfPointsOver: number;
}

export type SkillRunStatus =
  | "queued"
  | "waiting_confirm"
  | "running"
  | "waiting_job"
  | "completed"
  | "failed"
  | "cancelled";

export interface SkillRunStepView {
  id: string;
  label: string;
  type: string;
  index: number;
  done: boolean;
  current: boolean;
  outputs?: {
    jobId: string;
    outputIds: string[];
    urls: string[];
    /** 套图步骤 VLM 选定的主图索引（0-based） */
    heroOutputIndex?: number;
  };
}

export interface SkillRun {
  id: string;
  sessionId: string;
  skillId: string;
  skillVersion: number;
  skillName: string;
  description?: string;
  status: SkillRunStatus;
  prompt: string;
  steps: SkillRunStepView[];
  currentStepIndex: number;
  pendingJobId: string | null;
  estimatedPoints: number;
  confirmIfPointsOver: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export type DramaRunStatus =
  | "planning"
  | "waiting_confirm"
  | "queued"
  | "running"
  | "waiting_job"
  | "completed"
  | "failed"
  | "cancelled";

export interface DramaCharacterCard {
  id: string;
  name: string;
  role?: string;
  personalityTone: string;
  promptAnchor: string;
  voiceStyle?: string;
  visualSignature: {
    ageRange: string;
    faceShape: string;
    eyeShape: string;
    hairStyle: string;
    skinTone: string;
    signatureOutfit: string;
    distinguishingFeatures: string[];
  };
  refOutputIds?: Partial<{
    front: string;
    three_quarter: string;
    side: string;
  }>;
  /** 草稿态用户上传的角色参考图 */
  refUrl?: string;
}

export interface DramaStoryboardShot {
  id: string;
  order: number;
  sceneId: string;
  characterIds: string[];
  dialogue: Array<{ characterId: string; line: string }>;
  visualPrompt: string;
  motionPrompt: string;
  cameraSpec: {
    shotSize: string;
    movement: string;
    lighting: string;
    colorTemp?: string;
  };
  durationSec: number;
  useLastFrameContinuity: boolean;
  keyframeOutputId?: string;
  keyframeVariantOutputIds?: string[];
  keyframeHeroIndex?: number;
  keyframeVariantUrls?: string[];
  videoOutputId?: string;
  audioOutputId?: string;
  lipsyncOutputId?: string;
  keyframeUrl?: string;
  videoUrl?: string;
  auditScore?: { character?: number; style?: number };
  status: "pending" | "keyframe" | "video" | "audio" | "done" | "failed";
}

export interface DramaProjectPayload {
  userIdea: string;
  targetDurationSec: number;
  script: {
    title: string;
    logline: string;
    acts: Array<{ act: number; sceneId: string; summary: string; emotion?: string }>;
    narratorLines: string[];
  };
  styleBible: {
    palette: string[];
    lightingStyle: string;
    filmGrain?: string;
    aspectRatio: "9:16" | "16:9";
    negativePrompt: string;
    globalContextBlock?: string;
  };
  characters: DramaCharacterCard[];
  scenes: Array<{
    id: string;
    name: string;
    location: string;
    atmosphere: string;
    promptAnchor: string;
    props: string[];
    refOutputId?: string;
    refUrl?: string;
  }>;
  shots: DramaStoryboardShot[];
  productionParams?: {
    aspectRatio?: "9:16" | "16:9";
    imageModelId?: string;
    videoModelId?: string;
    resolution?: "1k" | "2k";
    previewTier?: "low" | "full";
    bgmUrl?: string;
  };
}

export interface DramaPipelineStepView {
  id: string;
  label: string;
  index: number;
  done: boolean;
  current: boolean;
}

export interface DramaRun {
  id: string;
  projectId: string;
  sessionId: string;
  skillId: string;
  status: DramaRunStatus;
  estimatedPoints: number;
  confirmIfPointsOver: number;
  currentStepIndex: number;
  pendingJobId: string | null;
  finalVideoUrl: string | null;
  error: string | null;
  project: DramaProjectPayload;
  pipelineSteps: DramaPipelineStepView[];
  createdAt: string;
  updatedAt: string;
}

export interface DramaProject {
  id: string;
  sessionId: string;
  userIdea: string;
  status: string;
  project: DramaProjectPayload;
  createdAt: string;
  updatedAt: string;
}

export type DramaPlanAgentStatus =
  | "pending"
  | "running"
  | "done"
  | "failed";

export interface DramaPlanAgentState {
  status: DramaPlanAgentStatus;
  reasoning?: string;
  summary?: string;
  completedAt?: string;
}

export interface DramaPlanRun {
  id: string;
  sessionId: string;
  userIdea: string;
  targetDurationSec?: number;
  aspectRatio?: "9:16" | "16:9";
  status: "planning" | "completed" | "failed";
  currentAgent?: string | null;
  agents: Record<string, DramaPlanAgentState>;
  reasoning?: Record<string, string>;
  projectId?: string | null;
  project?: DramaProject;
  estimatedPoints?: number;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductSetInit {
  platforms: string[];
  markets: string[];
  languages: string[];
  designers: string[];
  slides: { key: string; label: string }[];
}

export interface StudioTool {
  id: string;
  name: string;
  description: string;
  category?: "edit" | "enhance" | "compose";
  defaultPrompt: string;
  pricingFactor?: number;
  clientOnly?: boolean;
  requiresSource?: boolean;
}

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price_cents: number;
  badge: string | null;
  sort_order: number;
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  link_label: string | null;
  link_path: string | null;
  created_at?: string;
}

export interface SignStatus {
  signedToday: boolean;
  todayReward: number;
  recentSignDays: number;
  signDate: string;
}

export interface InviteInfo {
  code: string;
  inviteCount: number;
  pendingInviteCount?: number;
  rewardPerInvite: number;
  totalEarned: number;
  inviteUrl: string;
}

export interface SessionShareStatus {
  active: boolean;
  expiresAt: string | null;
  createdAt: string | null;
}

export interface PublicSharePayload {
  sessionId: string;
  title: string;
  mode: string;
  kind: string;
  status: string;
  updatedAt: string;
  expiresAt: string | null;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    outputs: Array<{ id: string; url: string; sort_order: number; label?: string }>;
  }>;
  canvasLayout?: unknown;
}
