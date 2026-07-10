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

export interface DramaTemplateMetadata {
  userIdea: string;
  projectType: "short_drama" | "mv" | "creative";
  targetDurationSec?: number;
  aspectRatio?: "9:16" | "16:9";
  scriptTitle?: string;
  logline?: string;
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
  /** 制片模板元数据（PROD-B06） */
  dramaTemplate?: DramaTemplateMetadata;
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
  /** 列表封面：canvas_layout 首图 */
  cover_url?: string | null;
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
  voiceId?: string;
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
  /** 三视图定稿状态（制片前须 locked） */
  turnaroundStatus?: "draft" | "locked";
  /** 序列化后的三视图 URL（只读） */
  refUrls?: Partial<{
    front: string;
    three_quarter: string;
    side: string;
  }>;
  /** 后端 job 队列中是否有待完成的三视图任务 */
  turnaroundPending?: boolean;
}

export interface DramaVoiceOption {
  id: string;
  label: string;
  description: string;
  sampleText: string;
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
  /** D-S2：绑定的电商主图 outputId，存在时跳过关键帧生成 */
  commerceHeroOutputId?: string;
  /** D-S2：电商主图来源 */
  commerceHeroSource?: "ecommerce_set" | "commerce_promo_cutout" | "commerce_promo_upscale";
  keyframeVariantUrls?: string[];
  videoOutputId?: string;
  audioOutputId?: string;
  lipsyncOutputId?: string;
  keyframeUrl?: string;
  videoUrl?: string;
  auditScore?: { character?: number; style?: number };
  status: "pending" | "keyframe" | "video" | "audio" | "done" | "failed";
}

export type DramaProjectType = "short_drama" | "mv" | "creative";

export interface DramaSceneCard {
  id: string;
  name: string;
  location: string;
  era?: string;
  atmosphere: string;
  promptAnchor: string;
  props: string[];
  refOutputId?: string;
  refUrl?: string;
  /** 后端 job 队列中是否有待完成的场景参考图任务 */
  refPending?: boolean;
}

export interface DramaProjectPayload {
  projectType?: DramaProjectType;
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
  scenes: DramaSceneCard[];
  shots: DramaStoryboardShot[];
  timeline?: DramaTimelineTrack[];
  productionParams?: {
    aspectRatio?: "9:16" | "16:9";
    imageModelId?: string;
    videoModelId?: string;
    resolution?: "1k" | "2k";
    previewTier?: "low" | "full";
    bgmUrl?: string;
    autoQcRetry?: boolean;
    qcRetryThreshold?: number;
    qcAutoRetryMaxShots?: number;
  };
}

export interface DramaTimelineClip {
  id: string;
  trackId: string;
  sourceId?: string;
  startSec: number;
  durationSec: number;
  offsetSec: number;
  volume: number;
}

export interface DramaTimelineTrack {
  id: string;
  type: "video" | "audio_dialogue" | "audio_bgm";
  label: string;
  clips: DramaTimelineClip[];
}

export type WorkspaceReviewTargetType = "project" | "run" | "shot";
export type WorkspaceReviewStatus = "open" | "resolved";

export interface WorkspaceReview {
  id: string;
  workspaceId: string;
  projectId: string | null;
  runId: string | null;
  shotId: string | null;
  targetType: WorkspaceReviewTargetType;
  title: string;
  body: string | null;
  status: WorkspaceReviewStatus;
  createdBy: string;
  createdByEmail: string;
  resolvedBy: string | null;
  resolvedByEmail: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  commentCount: number;
}

export interface WorkspaceReviewComment {
  id: string;
  reviewId: string;
  userId: string;
  userEmail: string;
  content: string;
  mentions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DramaPipelineStepView {
  id: string;
  label: string;
  index: number;
  done: boolean;
  current: boolean;
}

export interface DramaRunProgress {
  currentPipelineStep: string;
  shotIndex: number;
  charRefIndex?: number;
  sceneRefIndex?: number;
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
  finalVideoOutputId?: string | null;
  error: string | null;
  progress?: DramaRunProgress;
  project: DramaProjectPayload;
  pipelineSteps: DramaPipelineStepView[];
  createdAt: string;
  updatedAt: string;
}

export type DramaRunGraphNodeStatus =
  | "pending"
  | "running"
  | "done"
  | "failed";

export interface DramaRunGraphNode {
  id: string;
  stepId: string;
  label: string;
  type: string;
  status: DramaRunGraphNodeStatus;
  index: number;
}

export interface DramaRunGraphEdge {
  id: string;
  source: string;
  target: string;
}

export interface DramaRunGraph {
  runId: string;
  skillId: string;
  nodes: DramaRunGraphNode[];
  edges: DramaRunGraphEdge[];
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

// PROD-C07 — 版本对比与回滚
export type DramaProjectVersionTrigger =
  | "initial"
  | "manual_patch"
  | "auto_save"
  | "restore";

export interface DramaProjectVersionSummary {
  id: string;
  projectId: string;
  trigger: DramaProjectVersionTrigger;
  parentVersionId: string | null;
  note: string | null;
  createdAt: string;
  isCurrent: boolean;
}

export interface DramaProjectVersionDetail
  extends DramaProjectVersionSummary {
  project: DramaProject;
}

export interface DramaProjectVersionDiff {
  versionAId: string;
  versionBId: string;
  changedPaths: string[];
  stats: {
    added: number;
    modified: number;
    removed: number;
  };
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

export interface DramaReplicateProfile {
  sourceUrl: string;
  title?: string;
  hook?: string;
  beatStructure: string[];
  pacing?: string;
  suggestedDurationSec?: number;
  styleHints: string[];
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
  autoProduce?: boolean;
  projectType?: DramaProjectType;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type DramaPlanTurnKind = "initial" | "refine";

/** 多轮对话回合（策划线程） */
export interface DramaPlanTurn {
  id: string;
  sessionId: string;
  projectId?: string | null;
  planRunId?: string | null;
  versionId?: string | null;
  kind: DramaPlanTurnKind;
  instruction: string;
  assistantAck?: string;
  createdAt: string;
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
