export const TEXT_FONT_OPTIONS = [
  { id: "sans", label: "无衬线", css: "system-ui, sans-serif" },
  { id: "serif", label: "衬线", css: "Georgia, 'Songti SC', serif" },
  { id: "song", label: "宋体", css: "'Songti SC', 'SimSun', serif" },
  { id: "hei", label: "黑体", css: "'Heiti SC', 'Microsoft YaHei', sans-serif" },
  { id: "kai", label: "楷体", css: "'Kaiti SC', KaiTi, serif" },
  { id: "mono", label: "等宽", css: "ui-monospace, monospace" },
] as const;

export type TextFontId = (typeof TEXT_FONT_OPTIONS)[number]["id"];

export const TEXT_SIZE_OPTIONS = [
  { id: "sm", label: "小", px: 18 },
  { id: "md", label: "中", px: 28 },
  { id: "lg", label: "大", px: 40 },
  { id: "xl", label: "特大", px: 56 },
] as const;

export type TextSizeId = (typeof TEXT_SIZE_OPTIONS)[number]["id"];

export function buildTextToolPrompt(
  content: string,
  fontId: TextFontId,
  sizeId: TextSizeId,
): string {
  const font = TEXT_FONT_OPTIONS.find((f) => f.id === fontId) ?? TEXT_FONT_OPTIONS[0];
  const size = TEXT_SIZE_OPTIONS.find((s) => s.id === sizeId) ?? TEXT_SIZE_OPTIONS[1];
  const trimmed = content.trim();
  return `使用「${font.label}」风格字体（${font.css}），字号约 ${size.px}px，无痕替换画面中的文字为：${trimmed}。保持原图光影、材质与透视一致。`;
}
