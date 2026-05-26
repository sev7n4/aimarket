import { z } from "zod";

export type ToolCategory = "edit" | "enhance" | "compose";

export interface StudioToolDefinition {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  defaultPrompt: string;
  /** 相对基础积分的倍数 */
  pricingFactor: number;
  /** 仅客户端处理（如 Fabric 裁剪），不创建 job */
  clientOnly?: boolean;
  /** 建议画布已选图片或上传附件 */
  requiresSource?: boolean;
  legacyAliases?: string[];
}

export const STUDIO_TOOLS: StudioToolDefinition[] = [
  {
    id: "expand",
    name: "AI 扩图",
    description: "扩展画面边界，保持风格与主体一致",
    category: "edit",
    defaultPrompt: "扩展图片画布，自然延伸背景，保持主体清晰",
    pricingFactor: 1.2,
    requiresSource: true,
    legacyAliases: ["extendImage"],
  },
  {
    id: "erase",
    name: "AI 智能消除",
    description: "去除画面中多余杂物或路人",
    category: "edit",
    defaultPrompt: "智能消除画面中多余元素，保持背景自然",
    pricingFactor: 1,
    requiresSource: true,
    legacyAliases: ["removeBackground"],
  },
  {
    id: "cutout",
    name: "一键抠图",
    description: "智能抠图去背，生成透明底 PNG",
    category: "edit",
    defaultPrompt: "抠出主体，生成干净透明背景",
    pricingFactor: 0.8,
    requiresSource: true,
    legacyAliases: ["cutout"],
  },
  {
    id: "inpaint",
    name: "局部修改",
    description: "对指定区域进行局部重绘",
    category: "edit",
    defaultPrompt: "对画面局部区域进行精细修改，与整体风格协调",
    pricingFactor: 1.1,
    requiresSource: true,
    legacyAliases: ["partialEdit"],
  },
  {
    id: "text",
    name: "无痕改字",
    description: "替换画面中的文字且保持质感",
    category: "edit",
    defaultPrompt: "无痕替换画面中的文字，保持光影与材质一致",
    pricingFactor: 1,
    requiresSource: true,
    legacyAliases: ["editText"],
  },
  {
    id: "upscale",
    name: "AI 超清放大",
    description: "提升分辨率，保留细节",
    category: "enhance",
    defaultPrompt: "高清放大，增强细节与锐度，保持风格一致",
    pricingFactor: 1.5,
    requiresSource: true,
    legacyAliases: ["upscaling"],
  },
  {
    id: "enhance",
    name: "图片变清晰",
    description: "轻量增强清晰度与对比度",
    category: "enhance",
    defaultPrompt: "提升画面清晰度，自然锐化，不过度处理",
    pricingFactor: 0.9,
    requiresSource: true,
    legacyAliases: ["enhance"],
  },
  {
    id: "blend",
    name: "多图融合",
    description: "将多张素材融合为一张",
    category: "compose",
    defaultPrompt: "将多张参考图融合为一张协调的商业画面",
    pricingFactor: 1.3,
    legacyAliases: ["uploadGenerate"],
  },
  {
    id: "crop",
    name: "图片裁剪",
    description: "在画布上拖拽裁剪（无需 AI 出图）",
    category: "edit",
    defaultPrompt: "按电商标准构图裁剪，突出主体",
    pricingFactor: 0,
    clientOnly: true,
  },
];

const toolRunBodySchema = z.object({
  sessionId: z.string().uuid(),
  prompt: z.string().max(4000).optional(),
  modelId: z.string().optional(),
  resolution: z.enum(["1k", "2k", "4k"]).default("1k"),
  referenceOutputIds: z.array(z.string().uuid()).optional(),
  assetIds: z.array(z.string().uuid()).optional(),
  scale: z.enum(["2x", "4x"]).optional(),
});

export type ToolRunBody = z.infer<typeof toolRunBodySchema>;

export function getTool(id: string): StudioToolDefinition | undefined {
  return STUDIO_TOOLS.find((t) => t.id === id);
}

export function getToolByLegacyAlias(alias: string): StudioToolDefinition | undefined {
  return STUDIO_TOOLS.find((t) => t.legacyAliases?.includes(alias));
}

export function parseToolRunBody(input: unknown): ToolRunBody {
  return toolRunBodySchema.parse(input);
}

export function listToolsPublic() {
  return STUDIO_TOOLS.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    category: t.category,
    defaultPrompt: t.defaultPrompt,
    pricingFactor: t.pricingFactor,
    clientOnly: t.clientOnly ?? false,
    requiresSource: t.requiresSource ?? false,
  }));
}
