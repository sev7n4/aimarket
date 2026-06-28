import { z } from "zod";

export const planStepSchema = z.object({
  type: z.enum(["generate", "tool", "video"]),
  toolId: z.string().optional(),
  label: z.string(),
  prompt: z.string().optional(),
  dependsOn: z.string().optional(),
  /** canvas_* 工具的结构化参数（type/position/nodeId/sourceNodeId 等） */
  args: z.record(z.unknown()).optional(),
});

export const agentPlanSchema = z.object({
  intent: z.string(),
  modelId: z.string(),
  mode: z.string(),
  resolution: z.string(),
  aspectRatio: z.string(),
  count: z.number().int().min(1),
  steps: z.array(planStepSchema).min(1),
  estimatedPoints: z.number().int().min(0),
  requiresConfirm: z.boolean(),
  reason: z.string(),
  skillId: z.string().optional(),
  planSource: z.enum(["llm", "rule"]).optional(),
});

export type PlanStep = z.infer<typeof planStepSchema>;
export type AgentPlan = z.infer<typeof agentPlanSchema>;

export const llmPlanDraftSchema = z.object({
  intent: z.string(),
  skillId: z.string().optional(),
  steps: z.array(
    z.object({
      type: z.enum(["generate", "tool", "video"]),
      toolId: z.string().optional(),
      label: z.string(),
      prompt: z.string().optional(),
      args: z.record(z.unknown()).optional(),
    }),
  ),
  requiresConfirm: z.boolean().optional(),
  reason: z.string().optional(),
});

export type LlmPlanDraft = z.infer<typeof llmPlanDraftSchema>;
