import { resolveImageDimensions } from "../lib/image-size.js";
import { saveGeneratedImage } from "../lib/storage.js";
import type { GenerateParams, GenerateResult, ImageProvider } from "./types.js";

/** DALL·E 3 仅支持三种尺寸 */
function resolveOpenAiSize(resolution: string, aspectRatio: string): string {
  const [w, h] = resolveImageDimensions(resolution, aspectRatio);
  const ratio = w / h;
  if (ratio > 1.15) return "1792x1024";
  if (ratio < 0.87) return "1024x1792";
  return "1024x1024";
}

function usesDalle3(model: string) {
  return model === "dall-e-3" || model.includes("dall-e-3");
}

/** OpenAI 兼容 Images API（DALL·E 等），需配置 OPENAI_API_KEY */
export const openaiProvider: ImageProvider = {
  name: "openai",
  supports: (modelId) => {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return false;
    return ["omni-v2", "latest-v2-pro", "dall-e-3", "dall-e-2"].includes(
      modelId,
    );
  },
  async generate(params: GenerateParams): Promise<GenerateResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    const base =
      process.env.OPENAI_BASE_URL?.replace(/\/$/, "") ??
      "https://api.openai.com/v1";
    if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

    const model =
      process.env.OPENAI_IMAGE_MODEL ??
      (params.modelId.includes("pro") ? "dall-e-3" : "dall-e-2");
    const size = usesDalle3(model)
      ? resolveOpenAiSize(params.resolution, params.aspectRatio ?? "1:1")
      : "1024x1024";

    const urls: string[] = [];
    const useB64 = usesDalle3(model);

    for (let i = 0; i < params.count; i++) {
      const res = await fetch(`${base}/images/generations`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          prompt: params.prompt.slice(0, 4000),
          n: 1,
          size,
          response_format: useB64 ? "b64_json" : "url",
        }),
        signal: AbortSignal.timeout(120_000),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenAI API error: ${res.status} ${err.slice(0, 500)}`);
      }

      const json = (await res.json()) as {
        data?: { url?: string; b64_json?: string }[];
      };
      const item = json.data?.[0];
      if (useB64 && item?.b64_json) {
        const buffer = Buffer.from(item.b64_json, "base64");
        urls.push(saveGeneratedImage(buffer, "image/png").url);
      } else if (item?.url) {
        urls.push(item.url);
      } else {
        throw new Error("OpenAI returned no image data");
      }
    }

    return { urls, provider: "openai" };
  },
};
