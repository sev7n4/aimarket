import { z } from "zod";
import { randomUUID } from "node:crypto";

export const focusPointBodySchema = z
  .object({
    sessionId: z.string().uuid(),
    imageUrl: z.string().url().optional(),
    imageBase64: z
      .string()
      .max(2_000_000)
      .optional(),
    x: z.number().min(0).max(1).optional(),
    y: z.number().min(0).max(1).optional(),
    cropSize: z.number().int().min(32).max(512).optional(),
  })
  .refine((b) => Boolean(b.imageUrl?.trim() || b.imageBase64?.trim()), {
    message: "须提供 imageUrl 或 imageBase64",
  });

export type FocusPointBody = z.infer<typeof focusPointBodySchema>;

export const focusPointEntrySchema = z.object({
  pointId: z.string().min(1).max(64),
  objectName: z.string().max(120),
  x: z.number().min(0).max(1).optional(),
  y: z.number().min(0).max(1).optional(),
});

export const focusEditIntentSchema = z.enum(["edit", "replace"]);

export type FocusEditIntent = z.infer<typeof focusEditIntentSchema>;

export function parseFocusPointBody(input: unknown): FocusPointBody {
  return focusPointBodySchema.parse(input);
}

/** 拼进 tool job 的 focus-edit 专用 prompt */
export function buildFocusEditPrompt(
  userPrompt: string,
  points: { objectName: string }[],
  intent: FocusEditIntent,
): string {
  const trimmed = userPrompt.trim();
  const names = points
    .map((p) => p.objectName.trim() || "目标区域")
    .filter(Boolean);
  if (names.length > 1) {
    const target = names.map((n) => `「${n}」`).join("、");
    if (intent === "replace") {
      return `针对以下焦点分别处理：${target}。将对应物体替换为：${trimmed}。保持周围背景、光影与透视一致，融合自然。`;
    }
    return `针对以下焦点分别处理：${target}。${trimmed}。其余区域保持不变，光影与透视一致。`;
  }

  const target = names.length === 1 ? `「${names[0]}」` : "「目标区域」";

  if (intent === "replace") {
    return `将画面中${target}替换为：${trimmed}。保持周围背景、光影与透视一致，融合自然。`;
  }
  return `仅修改画面中${target}区域：${trimmed}。其余区域保持不变，光影与透视一致。`;
}

export function newFocusPointId(): string {
  return `fp_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}
