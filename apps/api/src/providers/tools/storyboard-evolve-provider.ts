/**
 * 剧情推演四宫格工具 Provider
 *
 * 基于当前帧推演 4 个时间点的画面：
 *   1. "3秒前" — 当前场景的前序
 *   2. "当前帧" — 直接复用参考图
 *   3. "3秒后" — 当前场景的延续
 *   4. "5秒后" — 场景进一步发展
 */
import { generateImages } from "../registry.js";
import { resolveImageDimensions } from "../../lib/image-size.js";
import type { ImageToolProvider, ToolRunParams, ToolRunResult } from "./types.js";

/** 4 个时间推演定义 */
const STORYBOARD_EVOLVE_STAGES = [
  { label: "3秒前", suffix: "the scene 3 seconds before this moment, showing what led up to the current frame" },
  { label: "当前帧", suffix: "" },
  { label: "3秒后", suffix: "the scene 3 seconds after this moment, showing what happens next as a natural continuation" },
  { label: "5秒后", suffix: "the scene 5 seconds after this moment, showing further development and progression of the action" },
] as const;

export const storyboardEvolveProvider: ImageToolProvider = {
  name: "tool-storyboard-evolve",
  supports(toolId: string) {
    return toolId === "storyboard-evolve";
  },
  async run(params: ToolRunParams): Promise<ToolRunResult> {
    const [w, h] = resolveImageDimensions(params.resolution, params.aspectRatio ?? "1:1");
    const refUrl = params.referenceUrls[0];
    const urls: string[] = [];

    for (const stage of STORYBOARD_EVOLVE_STAGES) {
      if (stage.label === "当前帧" && refUrl) {
        // 当前帧直接复用参考图
        urls.push(refUrl);
        continue;
      }

      // 其他时间点需要生成新图
      const prompt = stage.suffix
        ? `${params.prompt}, ${stage.suffix}`
        : params.prompt;

      const result = await generateImages({
        prompt,
        modelId: params.modelId,
        count: 1,
        resolution: params.resolution,
        aspectRatio: params.aspectRatio,
        referenceUrls: refUrl ? [refUrl] : undefined,
        userId: params.userId,
      });
      urls.push(...result.urls);
    }

    return {
      urls,
      provider: "tool-storyboard-evolve",
      width: w,
      height: h,
    };
  },
};
