import { z } from "zod";

export const optimizeModeSchema = z.enum(["chat", "image", "ecommerce"]);

export type OptimizeMode = z.infer<typeof optimizeModeSchema>;

export type PromptOptimizeSource = "template-mock" | "openai";

export interface PromptOptimizeResult {
  prompt: string;
  source: PromptOptimizeSource;
}
