import { z } from "zod";

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
