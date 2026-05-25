import type { GenerateParams, GenerateResult, ImageProvider } from "./types.js";
import { resolveImageDimensions } from "../lib/image-size.js";

function placeholderUrl(seed: string, index: number, w: number, h: number) {
  const s = encodeURIComponent(seed.slice(0, 48) || "aimarket");
  return `https://picsum.photos/seed/${s}-${index}/${w}/${h}`;
}

export const mockProvider: ImageProvider = {
  name: "mock",
  supports: () => true,
  async generate(params: GenerateParams): Promise<GenerateResult> {
    const [w, h] = resolveImageDimensions(
      params.resolution,
      params.aspectRatio ?? "1:1",
    );
    const urls: string[] = [];
    for (let i = 0; i < params.count; i++) {
      urls.push(placeholderUrl(`${params.prompt}-${params.modelId}`, i, w, h));
    }
    return { urls, provider: "mock" };
  },
};
