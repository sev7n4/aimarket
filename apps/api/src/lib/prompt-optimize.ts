import { z } from "zod";

export const optimizeModeSchema = z.enum(["chat", "quick", "ecommerce"]);

const TEMPLATES: Record<
  z.infer<typeof optimizeModeSchema>,
  (raw: string) => string
> = {
  chat: (raw) =>
    `请对照片进行以下修改，保持人物自然、光影真实：${raw.trim()}。输出高清成片。`,
  quick: (raw) =>
    `快速生成：${raw.trim()}。画面干净、构图专业、适合商用。`,
  ecommerce: (raw) =>
    `电商详情文案与画面：${raw.trim()}。突出卖点、符合淘宝主图规范。`,
};

export function optimizePrompt(
  mode: z.infer<typeof optimizeModeSchema>,
  raw: string,
): string {
  const trimmed = raw.trim();
  if (!trimmed) return raw;
  return TEMPLATES[mode](trimmed);
}
