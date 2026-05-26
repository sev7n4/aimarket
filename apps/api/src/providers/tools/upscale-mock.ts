import { resolveImageDimensions } from "../../lib/image-size.js";
import { saveGeneratedImage } from "../../lib/storage.js";
import type { ImageToolProvider, ToolRunParams, ToolRunResult } from "./types.js";

const ENHANCE_TOOL_IDS = new Set(["upscale", "enhance"]);

/** 最小 JPEG 占位（mock 超分/增强交付） */
const PLACEHOLDER_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBEQCEAwEPwAB//9k=",
  "base64",
);

function parseUpscaleFactor(prompt: string): 2 | 4 {
  if (/4\s*[xX倍]/.test(prompt)) return 4;
  return 2;
}

function scaledDimensions(
  params: ToolRunParams,
  factor: number,
): [number, number] {
  const [w, h] = resolveImageDimensions(
    params.resolution,
    params.aspectRatio ?? "1:1",
  );
  const cap = 4096;
  return [
    Math.min(Math.round(w * factor), cap),
    Math.min(Math.round(h * factor), cap),
  ];
}

export const upscaleMockProvider: ImageToolProvider = {
  name: "tool-upscale-mock",
  supports(toolId: string) {
    return ENHANCE_TOOL_IDS.has(toolId);
  },
  async run(params: ToolRunParams): Promise<ToolRunResult> {
    const factor =
      params.toolId === "enhance" ? 1 : parseUpscaleFactor(params.prompt);
    const [width, height] = scaledDimensions(params, factor);
    const saved = await saveGeneratedImage(PLACEHOLDER_JPEG, "image/jpeg");

    return {
      urls: [saved.url],
      provider: "tool-upscale-mock",
      mimeType: "image/jpeg",
      scale: params.toolId === "enhance" ? "1x" : `${factor}x`,
      width,
      height,
    };
  },
};
