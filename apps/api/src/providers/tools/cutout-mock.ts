import { saveGeneratedImage } from "../../lib/storage.js";
import type { ImageToolProvider, ToolRunParams, ToolRunResult } from "./types.js";

/** 1×1 透明 PNG（mock 抠图交付） */
const TRANSPARENT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

export const cutoutMockProvider: ImageToolProvider = {
  name: "tool-cutout-mock",
  supports(toolId: string) {
    return toolId === "cutout";
  },
  async run(_params: ToolRunParams): Promise<ToolRunResult> {
    const saved = await saveGeneratedImage(TRANSPARENT_PNG, "image/png");
    return {
      urls: [saved.url],
      provider: "tool-cutout-mock",
      mimeType: "image/png",
    };
  },
};
