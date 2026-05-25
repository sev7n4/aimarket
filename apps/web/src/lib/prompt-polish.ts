/** 本地 Prompt 润色（Phase 1 占位，后续可接 LLM API） */
const TEMPLATES: Record<string, (raw: string) => string> = {
  chat: (raw) =>
    `请对照片进行以下修改，保持人物自然、光影真实：${raw.trim()}。输出高清成片。`,
  quick: (raw) =>
    `快速生成：${raw.trim()}。画面干净、构图专业、适合商用。`,
  ecommerce: (raw) =>
    `电商详情文案与画面：${raw.trim()}。突出卖点、符合淘宝主图规范。`,
};

export function polishPrompt(mode: string, raw: string): string {
  const t = TEMPLATES[mode] ?? TEMPLATES.chat;
  if (!raw.trim()) return raw;
  return t(raw);
}
