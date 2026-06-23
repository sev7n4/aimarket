import { z } from "zod";

/** RHTV Anchor First：角色三视图角度 */
export const characterAngleSchema = z.enum(["front", "three_quarter", "side"]);
export type CharacterAngle = z.infer<typeof characterAngleSchema>;

export const characterVisualSignatureSchema = z.object({
  ageRange: z.string(),
  faceShape: z.string(),
  eyeShape: z.string(),
  hairStyle: z.string(),
  skinTone: z.string(),
  signatureOutfit: z.string(),
  distinguishingFeatures: z.array(z.string()).default([]),
});

export const characterCardSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string().optional(),
  personalityTone: z.string(),
  visualSignature: characterVisualSignatureSchema,
  promptAnchor: z.string(),
  voiceStyle: z.string().optional(),
  /** 运行时：三视图 outputId */
  refOutputIds: z
    .object({
      front: z.string().uuid().optional(),
      three_quarter: z.string().uuid().optional(),
      side: z.string().uuid().optional(),
    })
    .optional(),
  /** 草稿态用户上传/替换的角色参考图 */
  refUrl: z.string().url().optional(),
  /** 三视图定稿状态（制片前须 locked） */
  turnaroundStatus: z.enum(["draft", "locked"]).optional(),
});

export const sceneCardSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  location: z.string(),
  era: z.string().optional(),
  atmosphere: z.string(),
  props: z.array(z.string()).default([]),
  promptAnchor: z.string(),
  refOutputId: z.string().uuid().optional(),
  /** 草稿态用户上传/替换的场景参考图 */
  refUrl: z.string().url().optional(),
});

export const styleBibleSchema = z.object({
  palette: z.array(z.string()).min(1),
  lightingStyle: z.string(),
  filmGrain: z.string().optional(),
  aspectRatio: z.enum(["9:16", "16:9"]).default("9:16"),
  negativePrompt: z.string().default(""),
  globalContextBlock: z.string().optional(),
});

export const dramaScriptBeatSchema = z.object({
  act: z.number().int().min(1).max(3),
  sceneId: z.string(),
  summary: z.string(),
  emotion: z.string().optional(),
});

export const dramaScriptSchema = z.object({
  title: z.string(),
  logline: z.string(),
  acts: z.array(dramaScriptBeatSchema).min(1),
  narratorLines: z.array(z.string()).default([]),
});

export const shotDialogueSchema = z.object({
  characterId: z.string(),
  line: z.string(),
});

export const cameraSpecSchema = z.object({
  shotSize: z.string(),
  movement: z.string(),
  lighting: z.string(),
  colorTemp: z.string().optional(),
});

export const storyboardShotSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().min(0),
  sceneId: z.string(),
  characterIds: z.array(z.string()),
  dialogue: z.array(shotDialogueSchema).default([]),
  visualPrompt: z.string(),
  motionPrompt: z.string(),
  cameraSpec: cameraSpecSchema,
  durationSec: z.number().min(2).max(10),
  /** Dream.ai：同场景连续镜头启用尾帧衔接 */
  useLastFrameContinuity: z.coerce.boolean().default(false),
  keyframeOutputId: z.string().uuid().optional(),
  /** 关键帧多候选 outputId（DRAMA_KEYFRAME_VARIANTS > 1） */
  keyframeVariantOutputIds: z.array(z.string().uuid()).optional(),
  /** 当前选中的关键帧候选索引 */
  keyframeHeroIndex: z.number().int().min(0).optional(),
  videoOutputId: z.string().uuid().optional(),
  audioOutputId: z.string().uuid().optional(),
  lipsyncOutputId: z.string().uuid().optional(),
  auditScore: z
    .object({
      character: z.number().min(0).max(100).optional(),
      style: z.number().min(0).max(100).optional(),
    })
    .optional(),
  status: z
    .enum(["pending", "keyframe", "video", "audio", "done", "failed"])
    .default("pending"),
});

export const dramaProjectSchema = z.object({
  userIdea: z.string(),
  targetDurationSec: z.number().int().min(60).max(180).default(90),
  script: dramaScriptSchema,
  styleBible: styleBibleSchema,
  characters: z.array(characterCardSchema).min(1).max(4),
  scenes: z.array(sceneCardSchema).min(1),
  shots: z.array(storyboardShotSchema).min(8).max(15),
  productionParams: z
    .object({
      aspectRatio: z.enum(["9:16", "16:9"]).default("9:16"),
      imageModelId: z.string().default("omni-v2"),
      videoModelId: z.string().default("wan-2.6"),
      resolution: z.enum(["1k", "2k"]).default("1k"),
      /** 低清预览档：跳过口型同步，积分更低 */
      previewTier: z.enum(["low", "full"]).default("full"),
      bgmUrl: z.string().url().optional(),
    })
    .optional(),
});

export type CharacterCard = z.infer<typeof characterCardSchema>;
export type SceneCard = z.infer<typeof sceneCardSchema>;
export type StyleBible = z.infer<typeof styleBibleSchema>;
export type DramaScript = z.infer<typeof dramaScriptSchema>;
export type StoryboardShot = z.infer<typeof storyboardShotSchema>;
export type DramaProjectData = z.infer<typeof dramaProjectSchema>;

export type DramaProjectStatus =
  | "drafting"
  | "waiting_confirm"
  | "confirmed"
  | "producing"
  | "completed"
  | "failed";

export type DramaRunStatus =
  | "planning"
  | "waiting_confirm"
  | "queued"
  | "running"
  | "waiting_job"
  | "completed"
  | "failed"
  | "cancelled";

export type DramaPipelineStep =
  | "char_refs"
  | "scene_refs"
  | "keyframes"
  | "shot_videos"
  | "tts"
  | "lipsync"
  | "narrator_tts"
  | "concat";

export const DRAMA_PIPELINE_STEPS: DramaPipelineStep[] = [
  "char_refs",
  "scene_refs",
  "keyframes",
  "shot_videos",
  "tts",
  "lipsync",
  "narrator_tts",
  "concat",
];

export interface DramaPendingBatchJob {
  shotId: string;
  jobId: string;
}

export interface DramaProgress {
  currentPipelineStep: DramaPipelineStep;
  charRefIndex: number;
  charRefAngleIndex: number;
  sceneRefIndex: number;
  shotIndex: number;
  ttsIndex: number;
  lipsyncIndex: number;
  keyframeRetries: Record<string, number>;
  /** 同场景无尾帧依赖的关键帧/视频可并行 */
  pendingBatch?: DramaPendingBatchJob[];
  narratorAudioOutputId?: string;
  finalVideoUrl?: string;
  /** concat 成片 outputId，供灵感发布 */
  finalVideoOutputId?: string;
}
