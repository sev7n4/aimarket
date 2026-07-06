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
  /** 用户最近被采纳的润色结果，作为个性化风格 few-shot 参考 */
  recentAccepted?: string[];
}

export const promptOptimizeContextSchema = z
  .object({
    modelId: z.string().max(64).optional(),
    aspectRatio: z.string().max(16).optional(),
    hasReferenceImages: z.boolean().optional(),
    creationLane: z.string().max(32).optional(),
    intentSignal: z.string().max(32).optional(),
    intentConfidence: z.number().min(0).max(1).optional(),
    recentAccepted: z.array(z.string().max(400)).max(5).optional(),
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
  /** 备选提示词（不含 prompt 本身），供前端"换一个"切换 */
  variants?: string[];
}
