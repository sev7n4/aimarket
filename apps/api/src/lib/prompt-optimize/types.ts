import { z } from "zod";

export const optimizeModeSchema = z.enum(["chat", "image", "ecommerce"]);

export type OptimizeMode = z.infer<typeof optimizeModeSchema>;

export interface PromptOptimizeContext {
  modelId?: string;
  aspectRatio?: string;
  hasReferenceImages?: boolean;
  creationLane?: string;
  /** 前端 resolveIntent 推断的主意图信号，如 "image-edit" */
  intentSignal?: string;
  /** 意图推断置信度 0-1 */
  intentConfidence?: number;
}

export const promptOptimizeContextSchema = z
  .object({
    modelId: z.string().max(64).optional(),
    aspectRatio: z.string().max(16).optional(),
    hasReferenceImages: z.boolean().optional(),
    creationLane: z.string().max(32).optional(),
    intentSignal: z.string().max(32).optional(),
    intentConfidence: z.number().min(0).max(1).optional(),
  })
  .optional();

export type PromptOptimizeSource =
  | "template-mock"
  | "openai"
  | "dashscope";

export interface PromptOptimizeResult {
  prompt: string;
  source: PromptOptimizeSource;
  /** 推断的意图方向（信号 id），用于 UI 展示与埋点 */
  direction?: string;
  /** 意图方向的中文标签，如 "局部编辑" */
  directionLabel?: string;
}
