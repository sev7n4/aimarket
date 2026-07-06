import type { StudioTool } from "@/lib/types";

export type SelectionToolInteraction =
  | "direct"
  | "brush"
  | "prompt"
  | "click"
  | "expand-frame";

const TOOL_INTERACTIONS: Record<string, SelectionToolInteraction> = {
  cutout: "direct",
  upscale: "direct",
  enhance: "direct",
  variation: "direct",
  "grid-split": "direct",
  erase: "brush",
  inpaint: "brush",
  "focus-edit": "click",
  expand: "expand-frame",
  text: "prompt",
  blend: "prompt",
};

export function getToolInteraction(toolId: string): SelectionToolInteraction {
  return TOOL_INTERACTIONS[toolId] ?? "prompt";
}

export function buildToolPromptSuffix(tool: StudioTool): string {
  switch (tool.id) {
    case "erase":
      return "请处理局部区域：去掉/清理 ";
    case "inpaint":
      return "请局部重绘：把指定区域改成 ";
    case "expand":
      return "请扩展画面，方向和要求是：";
    case "text":
      return "请修改图片文字为：";
    case "blend":
      return "请与另一个 @ 图片融合，要求是：";
    case "focus-edit":
      return tool.defaultPrompt;
    default:
      return `${tool.defaultPrompt}，要求是：`;
  }
}
