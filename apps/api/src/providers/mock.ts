import type { GenerateParams, GenerateResult, ImageProvider } from "./types.js";
import { saveGeneratedImage } from "../lib/storage.js";

/** 1×1 PNG，避免 CI mock 走 picsum 外网导致第二次生成失败 */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

export const mockProvider: ImageProvider = {
  name: "mock",
  supports: () => true,
  async generate(params: GenerateParams): Promise<GenerateResult> {
    const urls: string[] = [];
    for (let i = 0; i < params.count; i++) {
      const saved = await saveGeneratedImage(TINY_PNG, "image/png");
      urls.push(saved.url);
    }
    return { urls, provider: "mock" };
  },
};
