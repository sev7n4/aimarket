/**
 * 万相通用图像编辑 — 真扩图（function=expand + 四向 scale）
 * 文档：https://help.aliyun.com/zh/model-studio/wanx-image-edit-api-reference
 */
import {
  resolveExpandScales,
  type ExpandExtend,
} from "../../lib/expand-extend.js";
import {
  pollDashScopeTask,
  submitDashScopeImageSynthesis,
} from "../../lib/dashscope-async.js";
import type { ImageToolProvider, ToolRunParams, ToolRunResult } from "./types.js";

function resolveExpandMode(): "wan" | "mock" | "auto" | "http" | "seedream" {
  const raw = (process.env.TOOL_EXPAND_PROVIDER ?? "auto").toLowerCase();
  if (
    raw === "wan" ||
    raw === "mock" ||
    raw === "http" ||
    raw === "seedream"
  ) {
    return raw;
  }
  return "auto";
}

function isWanConfigured(): boolean {
  return Boolean(process.env.DASHSCOPE_API_KEY?.trim());
}

export function shouldUseWanExpand(): boolean {
  const mode = resolveExpandMode();
  if (mode === "mock" || mode === "http" || mode === "seedream") return false;
  if (mode === "wan") return true;
  return isWanConfigured();
}

function pickExtend(params: ToolRunParams): ExpandExtend | undefined {
  return params.extend ?? params.toolContext?.extend;
}

export const wanExpandToolProvider: ImageToolProvider = {
  name: "tool-wan-expand",
  supports(toolId: string) {
    return toolId === "expand" && shouldUseWanExpand();
  },
  async run(params: ToolRunParams): Promise<ToolRunResult> {
    const imageUrl = params.referenceUrls[0];
    if (!imageUrl) {
      throw new Error("扩图需要参考图 URL");
    }

    const model =
      process.env.ALIYUN_WAN_EXPAND_MODEL?.trim() ?? "wanx2.1-imageedit";
    const scales = resolveExpandScales(pickExtend(params));
    const prompt =
      (params.prompt ?? "").trim() || "自然扩展画面边缘，保持主体与风格一致";

    const taskId = await submitDashScopeImageSynthesis({
      model,
      input: {
        function: "expand",
        prompt,
        base_image_url: imageUrl,
      },
      parameters: {
        ...scales,
        n: Math.min(params.count ?? 1, 4),
      },
    });

    const urls = await pollDashScopeTask(taskId);

    return {
      urls,
      provider: "tool-wan-expand",
      mimeType: "image/jpeg",
      variant: "expand",
    };
  },
};
