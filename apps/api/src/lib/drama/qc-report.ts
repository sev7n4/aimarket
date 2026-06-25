import { z } from "zod";

export const dramaQcShotScoreSchema = z.object({
  shotId: z.string(),
  order: z.number().int(),
  compositionScore: z.number().min(0).max(100),
  consistencyScore: z.number().min(0).max(100),
  narrativeScore: z.number().min(0).max(100),
  overallScore: z.number().min(0).max(100),
  note: z.string().optional(),
});

export const dramaQcAutoRetrySchema = z.object({
  triggered: z.boolean(),
  threshold: z.number(),
  retriedShotIds: z.array(z.string()),
  reason: z.string().optional(),
});

export const dramaQcReportSchema = z.object({
  status: z.enum(["pending", "running", "completed", "failed"]),
  overallScore: z.number().min(0).max(100),
  compositionScore: z.number().min(0).max(100),
  consistencyScore: z.number().min(0).max(100),
  narrativeScore: z.number().min(0).max(100),
  shots: z.array(dramaQcShotScoreSchema),
  summary: z.string(),
  provider: z.string(),
  error: z.string().optional(),
  completedAt: z.string().optional(),
  autoRetry: dramaQcAutoRetrySchema.optional(),
});

export type DramaQcReport = z.infer<typeof dramaQcReportSchema>;
export type DramaQcShotScore = z.infer<typeof dramaQcShotScoreSchema>;

export function parseQcReportJson(raw: string | null): DramaQcReport | null {
  if (!raw) return null;
  try {
    return dramaQcReportSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}
