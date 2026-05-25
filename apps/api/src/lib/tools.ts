export interface StudioTool {
  id: string;
  name: string;
  description: string;
  defaultPrompt: string;
}

export const STUDIO_TOOLS: StudioTool[] = [
  {
    id: "expand",
    name: "AI 扩图",
    description: "扩展画面边界，保持风格与主体一致",
    defaultPrompt: "扩展图片画布，自然延伸背景，保持主体清晰",
  },
  {
    id: "erase",
    name: "AI 智能消除",
    description: "去除画面中多余杂物或路人",
    defaultPrompt: "智能消除画面中多余元素，保持背景自然",
  },
  {
    id: "inpaint",
    name: "局部修改",
    description: "对指定区域进行局部重绘",
    defaultPrompt: "对画面局部区域进行精细修改，与整体风格协调",
  },
  {
    id: "text",
    name: "无痕改字",
    description: "替换画面中的文字且保持质感",
    defaultPrompt: "无痕替换画面中的文字，保持光影与材质一致",
  },
  {
    id: "crop",
    name: "图片裁剪",
    description: "智能构图裁剪（Mock 输出）",
    defaultPrompt: "按电商标准构图裁剪，突出主体",
  },
  {
    id: "blend",
    name: "多图融合",
    description: "将多张素材融合为一张",
    defaultPrompt: "将多张参考图融合为一张协调的商业画面",
  },
];

export function getTool(id: string): StudioTool | undefined {
  return STUDIO_TOOLS.find((t) => t.id === id);
}
