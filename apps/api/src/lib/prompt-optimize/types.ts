import { z } from "zod";

export const optimizeModeSchema = z.enum(["chat", "image", "ecommerce"]);

export type OptimizeMode = z.infer<typeof optimizeModeSchema>;

export interface PromptOptimizeContext {
  modelId?: string;
  aspectRatio?: string;
  hasReferenceImages?: boolean;
  creationLane?: string;
}

export const promptOptimizeContextSchema = z
  .object({
    modelId: z.string().max(64).optional(),
    aspectRatio: z.string().max(16).optional(),
    hasReferenceImages: z.boolean().optional(),
    creationLane: z.string().max(32).optional(),
  })
  .optional();

export type PromptOptimizeSource =
  | "template-mock"
  | "openai"
  | "dashscope";

export interface PromptOptimizeResult {
  prompt: string;
  source: PromptOptimizeSource;
}
