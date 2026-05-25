import type { GenerateParams, GenerateResult, ImageProvider } from "./types.js";

const SIZE_MAP: Record<string, string> = {
  "1k": "1024x1024",
  "2k": "1024x1792",
  "4k": "1792x1024",
};

/** OpenAI 兼容 Images API（DALL·E 等），需配置 OPENAI_API_KEY */
export const openaiProvider: ImageProvider = {
  name: "openai",
  supports: (modelId) => {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return false;
    return ["omni-v2", "latest-v2-pro", "dall-e-3", "dall-e-2"].includes(modelId);
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
    const size = SIZE_MAP[params.resolution.toLowerCase()] ?? "1024x1024";

    const urls: string[] = [];
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
          response_format: "url",
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenAI API error: ${res.status} ${err}`);
      }

      const json = (await res.json()) as {
        data?: { url?: string }[];
      };
      const url = json.data?.[0]?.url;
      if (!url) throw new Error("OpenAI returned no image URL");
      urls.push(url);
    }

    return { urls, provider: "openai" };
  },
};
