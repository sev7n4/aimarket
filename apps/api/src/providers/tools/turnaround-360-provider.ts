/**
 * 360 度角度呈现工具 Provider
 *
 * 基于参考图生成 8 个方向的展示图，复用 generateImages 批量生图逻辑。
 * 8 个方向按八角形排列：正面、左前方、左侧、左后方、背面、右后方、右侧、右前方
 */
import { generateImages } from "../registry.js";
import { resolveImageDimensions } from "../../lib/image-size.js";
import type { ImageToolProvider, ToolRunParams, ToolRunResult } from "./types.js";

/** 8 个方向定义：中文名 / 英文 prompt 后缀 */
const TURNAROUND_360_ANGLES = [
  { label: "正面",     suffix: "front view, directly facing the camera, straight-on angle" },
  { label: "左前方",   suffix: "front-left 45-degree view, three-quarter angle from the front-left" },
  { label: "左侧",     suffix: "left side view, directly from the left side, profile shot" },
  { label: "左后方",   suffix: "rear-left 45-degree view, three-quarter angle from the rear-left" },
  { label: "背面",     suffix: "rear view, directly from behind the subject, back angle" },
  { label: "右后方",   suffix: "rear-right 45-degree view, three-quarter angle from the rear-right" },
  { label: "右侧",     suffix: "right side view, directly from the right side, profile shot" },
  { label: "右前方",   suffix: "front-right 45-degree view, three-quarter angle from the front-right" },
] as const;

/**
 * 为 8 个方向生成增强 prompt
 * @param basePrompt 用户原始 prompt
 * @returns 8 个增强后的 prompt
 */
export function generateTurnaround360Prompts(basePrompt: string): string[] {
  return TURNAROUND_360_ANGLES.map(
    (angle) => `${basePrompt}, ${angle.suffix}`,
  );
}

/** Turnaround360Provider：基于参考图批量生成 8 张不同角度图 */
export const turnaround360Provider: ImageToolProvider = {
  name: "tool-turnaround-360",
  supports(toolId: string) {
    return toolId === "turnaround-360";
  },
  async run(params: ToolRunParams): Promise<ToolRunResult> {
    const prompts = generateTurnaround360Prompts(params.prompt);
    const [w, h] = resolveImageDimensions(params.resolution, params.aspectRatio ?? "1:1");

    // 并发生成 8 张图
    const results = await Promise.all(
      prompts.map((prompt) =>
        generateImages({
          prompt,
          modelId: params.modelId,
          count: 1,
          resolution: params.resolution,
          aspectRatio: params.aspectRatio,
          referenceUrls: params.referenceUrls.length > 0 ? [params.referenceUrls[0]!] : undefined,
          userId: params.userId,
        }),
      ),
    );

    const urls = results.flatMap((r) => r.urls);
    return {
      urls,
      provider: "tool-turnaround-360",
      width: w,
      height: h,
    };
  },
};
