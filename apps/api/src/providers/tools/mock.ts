import { getTool } from "../../lib/tools.js";
import { resolveImageDimensions } from "../../lib/image-size.js";
import type { ImageToolProvider, ToolRunParams, ToolRunResult } from "./types.js";

function placeholderUrl(
  seed: string,
  index: number,
  w: number,
  h: number,
): string {
  const s = encodeURIComponent(seed.slice(0, 64) || "aimarket-tool");
  return `https://picsum.photos/seed/${s}-${index}/${w}/${h}`;
}

function seedForTool(params: ToolRunParams): string {
  const ref = params.referenceUrls[0];
  const refPart = ref ? ref.split("/").pop() ?? ref : "no-ref";
  return `${params.toolId}-${refPart}-${params.prompt.slice(0, 32)}`;
}

export const mockToolProvider: ImageToolProvider = {
  name: "tool-mock",
  supports(toolId: string) {
    return (
      Boolean(getTool(toolId)) &&
      toolId !== "cutout" &&
      toolId !== "upscale" &&
      toolId !== "enhance"
    );
  },
  async run(params: ToolRunParams): Promise<ToolRunResult> {
    const tool = getTool(params.toolId);
    if (!tool) {
      throw new Error(`未知工具: ${params.toolId}`);
    }

    const [w, h] = resolveImageDimensions(
      params.resolution,
      params.aspectRatio ?? "1:1",
    );
    const count = params.count ?? 1;
    const seed = seedForTool(params);
    const urls: string[] = [];

    for (let i = 0; i < count; i++) {
      urls.push(placeholderUrl(`${tool.id}-${seed}`, i, w, h));
    }

    return { urls, provider: "tool-mock" };
  },
};
