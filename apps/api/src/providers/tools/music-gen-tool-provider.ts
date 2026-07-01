/**
 * AI 音乐生成 Tool Provider
 *
 * 将 music-gen 工具桥接到现有 Tool Provider 体系。
 * 从 toolContext 中提取 style/bpm/durationSec 参数，
 * 委托给 generateMusic() 执行。
 */

import type { ImageToolProvider, ToolRunParams, ToolRunResult } from "./types.js";
import { generateMusic } from "../music-gen-provider.js";

const MUSIC_GEN_TOOL_ID = "music-gen";

export const musicGenToolProvider: ImageToolProvider = {
  name: "music-gen-tool",

  supports(toolId: string): boolean {
    return toolId === MUSIC_GEN_TOOL_ID;
  },

  async run(params: ToolRunParams): Promise<ToolRunResult> {
    const ctx = (params.toolContext as Record<string, unknown>) ?? {};
    const style =
      (ctx.style as string) ||
      params.prompt ||
      "轻快电子乐";
    const bpm =
      typeof ctx.bpm === "number" ? ctx.bpm : 120;
    const durationSec =
      typeof ctx.durationSec === "number" ? ctx.durationSec : 30;

    const result = await generateMusic({ style, bpm, durationSec });

    return {
      urls: [result.audioUrl],
      provider: result.provider,
      mimeType: "audio/mpeg",
      variant: "music-gen",
    };
  },
};
