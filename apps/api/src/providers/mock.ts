import type { GenerateParams, GenerateResult, ImageProvider } from "./types.js";

const SIZE_MAP: Record<string, [number, number]> = {
  "1k": [1024, 1024],
  "2k": [1536, 1536],
  "4k": [2048, 2048],
};

function placeholderUrl(seed: string, index: number, w: number, h: number) {
  const s = encodeURIComponent(seed.slice(0, 48) || "aimarket");
  return `https://picsum.photos/seed/${s}-${index}/${w}/${h}`;
}

export const mockProvider: ImageProvider = {
  name: "mock",
  supports: () => true,
  async generate(params: GenerateParams): Promise<GenerateResult> {
    const [w, h] = SIZE_MAP[params.resolution.toLowerCase()] ?? [1024, 1024];
    const urls: string[] = [];
    for (let i = 0; i < params.count; i++) {
      urls.push(placeholderUrl(`${params.prompt}-${params.modelId}`, i, w, h));
    }
    return { urls, provider: "mock" };
  },
};
