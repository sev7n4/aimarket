import { z } from "zod";
import { randomUUID } from "node:crypto";
import { encodeLightingPrompt, type LightSource } from "./lighting-prompt.js";

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

/** 物体语义类别（与前端 focus-edit.ts 中 ObjectCategory 对齐） */
export type ObjectCategory =
  | "text"
  | "person"
  | "face"
  | "small-object"
  | "medium-object"
  | "large-object"
  | "background"
  | "unknown";

/** 类别 → 领域约束词 */
const CATEGORY_CONSTRAINTS: Record<ObjectCategory, string> = {
  text: "保持字体风格、笔画粗细和排版位置一致",
  person: "保持人物比例、肤色和光影自然",
  face: "保持面部比例对称、皮肤质感自然",
  "small-object": "",
  "medium-object": "",
  "large-object": "",
  background: "保持背景透视和色彩过渡自然",
  unknown: "",
};

export function parseFocusPointBody(input: unknown): FocusPointBody {
  return focusPointBodySchema.parse(input);
}

/** 拼进 tool job 的 focus-edit 专用 prompt */
export function buildFocusEditPrompt(
  userPrompt: string,
  points: Array<{ objectName: string; category?: ObjectCategory }>,
  intent: FocusEditIntent,
  lights?: LightSource[],
): string {
  const trimmed = userPrompt.trim();
  const names = points
    .map((p) => p.objectName.trim() || "目标区域")
    .filter(Boolean);

  // 收集非空领域约束词（去重）
  const constraints = [
    ...new Set(
      points
        .map((p) => p.category && CATEGORY_CONSTRAINTS[p.category])
        .filter(Boolean) as string[],
    ),
  ];
  const constraintSuffix = constraints.length
    ? `。${constraints.join("，")}`
    : "";

  // 灯光追加
  const lightingSuffix = lights?.length
    ? `。灯光设置：${encodeLightingPrompt(lights)}。`
    : "";

  if (names.length > 1) {
    const target = names.map((n) => `「${n}」`).join("、");
    // 多点空间关系引导
    const spatialHint = "从左到右依次处理，各焦点独立编辑，互不影响。";
    if (intent === "replace") {
      return `针对以下焦点分别处理：${target}。将对应物体替换为：${trimmed}。${spatialHint}保持周围背景、光影与透视一致，融合自然${constraintSuffix}${lightingSuffix}`;
    }
    return `针对以下焦点分别处理：${target}。${trimmed}。${spatialHint}其余区域保持不变，光影与透视一致${constraintSuffix}${lightingSuffix}`;
  }

  const target = names.length === 1 ? `「${names[0]}」` : "「目标区域」";

  if (intent === "replace") {
    return `将画面中${target}替换为：${trimmed}。保持周围背景、光影与透视一致，融合自然${constraintSuffix}${lightingSuffix}`;
  }
  return `仅修改画面中${target}区域：${trimmed}。其余区域保持不变，光影与透视一致${constraintSuffix}${lightingSuffix}`;
}

export function newFocusPointId(): string {
  return `fp_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}
