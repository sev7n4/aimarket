import type { StudioTool } from "@/lib/types";

export type SelectionToolInteraction = "direct" | "prompt" | "click";

/** 已下线 Web UI 的工具（圈选/扩图依赖 FreeCanvas，Phase E 移除） */
export const OFFLINE_CANVAS_TOOLS = new Set(["expand", "inpaint", "erase"]);

const TOOL_INTERACTIONS: Record<string, SelectionToolInteraction> = {
  cutout: "direct",
  upscale: "direct",
  enhance: "direct",
  variation: "direct",
  "grid-split": "direct",
  "focus-edit": "click",
  text: "prompt",
  blend: "prompt",
};

export function getToolInteraction(toolId: string): SelectionToolInteraction {
  return TOOL_INTERACTIONS[toolId] ?? "prompt";
}

export function buildToolPromptSuffix(tool: StudioTool): string {
  switch (tool.id) {
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
