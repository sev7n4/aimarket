/**
 * Skill YAML Zod schema 定义
 * 基于 packages/agent-skills/skills/*.yaml 的实际格式
 */
import { z } from "zod";

// ─── 步骤类型参数 schema ─────────────────────────────

/** 生成套图步骤 */
const generateSetStepSchema = z.object({
  id: z.string().min(1),
  type: z.literal("generate_set"),
  label: z.string().min(1),
});

/** 工具步骤 */
const toolStepSchema = z.object({
  id: z.string().min(1),
  type: z.literal("tool"),
  toolId: z.string().min(1),
  label: z.string().min(1),
  sourceStep: z.string().min(1),
  sourceOutputIndex: z.number().int().min(0).default(0),
});

/** 视频步骤 */
const videoStepSchema = z.object({
  id: z.string().min(1),
  type: z.literal("video"),
  label: z.string().min(1),
  sourceStep: z.string().min(1),
  modelId: z.string().default("seedance-2"),
  resolution: z.enum(["1k", "2k"]).default("1k"),
  aspectRatio: z.string().default("9:16"),
});

/** 音乐生成步骤 */
const musicGenStepSchema = z.object({
  id: z.string().min(1),
  type: z.literal("music_gen"),
  label: z.string().min(1),
  options: z
    .object({
      defaultBpm: z.number().optional(),
      defaultDurationSec: z.number().optional(),
    })
    .optional(),
});

/** 角色定稿步骤 */
const characterRefsStepSchema = z.object({
  id: z.string().min(1),
  type: z.literal("character_refs"),
  label: z.string().min(1),
});

/** 场景定稿步骤 */
const sceneRefsStepSchema = z.object({
  id: z.string().min(1),
  type: z.literal("scene_refs"),
  label: z.string().min(1),
});

/** 分镜关键帧步骤 */
const keyframeBatchStepSchema = z.object({
  id: z.string().min(1),
  type: z.literal("keyframe_batch"),
  label: z.string().min(1),
  sourceSteps: z.array(z.string()).optional(),
  audit: z
    .object({
      characterMinScore: z.number().min(0).max(100).default(75),
      styleMinScore: z.number().min(0).max(100).default(70),
      maxRetries: z.number().int().min(0).max(5).default(2),
    })
    .optional(),
});

/** 逐镜视频步骤 */
const shotVideoBatchStepSchema = z.object({
  id: z.string().min(1),
  type: z.literal("shot_video_batch"),
  label: z.string().min(1),
  sourceStep: z.string().min(1),
});

/** TTS 步骤 */
const ttsBatchStepSchema = z.object({
  id: z.string().min(1),
  type: z.literal("tts_batch"),
  label: z.string().min(1),
});

/** 口型同步步骤 */
const lipsyncBatchStepSchema = z.object({
  id: z.string().min(1),
  type: z.literal("lipsync_batch"),
  label: z.string().min(1),
  sourceSteps: z.array(z.string()).optional(),
});

/** 剪辑合成步骤 */
const concatStepSchema = z.object({
  id: z.string().min(1),
  type: z.literal("concat"),
  label: z.string().min(1),
  sourceStep: z.string().min(1).optional(),
  sourceSteps: z.array(z.string()).optional(),
  options: z
    .object({
      subtitles: z.boolean().default(true),
      bgm: z.boolean().optional(),
    })
    .optional(),
});

// ─── 联合步骤 schema ─────────────────────────────

/** 所有步骤类型的联合 schema */
export const skillStepSchema = z.discriminatedUnion("type", [
  generateSetStepSchema,
  toolStepSchema,
  videoStepSchema,
  musicGenStepSchema,
  characterRefsStepSchema,
  sceneRefsStepSchema,
  keyframeBatchStepSchema,
  shotVideoBatchStepSchema,
  ttsBatchStepSchema,
  lipsyncBatchStepSchema,
  concatStepSchema,
]);

// ─── Skill 完整定义 schema ─────────────────────────────

/** Skill YAML 完整定义 schema */
export const SkillSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  name: z.string().min(1),
  description: z.string().optional(),
  confirmIfPointsOver: z.number().int().min(0).default(80),
  steps: z.array(skillStepSchema).min(1),
});

/** 从 schema 推导的类型 */
export type SkillDefinition = z.infer<typeof SkillSchema>;
export type SkillStep = z.infer<typeof skillStepSchema>;
