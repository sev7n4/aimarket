import { z } from "zod";

const auditSchema = z.object({
  characterMinScore: z.number().min(0).max(100).default(75),
  styleMinScore: z.number().min(0).max(100).default(70),
  maxRetries: z.number().int().min(0).max(5).default(2),
});

export const skillStepSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().min(1),
    type: z.literal("generate_set"),
    label: z.string().min(1),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("tool"),
    toolId: z.string().min(1),
    label: z.string().min(1),
    sourceStep: z.string().min(1),
    sourceOutputIndex: z.number().int().min(0).default(0),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("video"),
    label: z.string().min(1),
    sourceStep: z.string().min(1),
    modelId: z.string().default("seedance-2"),
    resolution: z.enum(["1k", "2k"]).default("1k"),
    aspectRatio: z.string().default("9:16"),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("character_refs"),
    label: z.string().min(1),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("scene_refs"),
    label: z.string().min(1),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("keyframe_batch"),
    label: z.string().min(1),
    sourceSteps: z.array(z.string()).optional(),
    audit: auditSchema.optional(),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("shot_video_batch"),
    label: z.string().min(1),
    sourceStep: z.string().min(1),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("tts_batch"),
    label: z.string().min(1),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("lipsync_batch"),
    label: z.string().min(1),
    sourceSteps: z.array(z.string()).optional(),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("concat"),
    label: z.string().min(1),
    sourceStep: z.string().min(1),
    options: z
      .object({
        subtitles: z.boolean().default(true),
        bgm: z.boolean().optional(),
      })
      .optional(),
  }),
]);

export const skillDefinitionSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  name: z.string().min(1),
  description: z.string().optional(),
  confirmIfPointsOver: z.number().int().min(0).default(80),
  steps: z.array(skillStepSchema).min(1),
});

export type SkillDefinition = z.infer<typeof skillDefinitionSchema>;
export type SkillStep = z.infer<typeof skillStepSchema>;
