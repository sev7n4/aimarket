import { resolveImageDimensions } from "../lib/image-size.js";
import { resolveOpenAiCredentials } from "../lib/user-provider-config.js";
import { saveGeneratedImage } from "../lib/storage.js";
import type {
  GenerateParams,
  GenerateResult,
  ImageProvider,
  EditParams,
  VariationParams,
  ImageRouteContext,
} from "./types.js";

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

function usesDalle2(model: string) {
  return model === "dall-e-2" || model.includes("dall-e-2");
}

function openAiAvailable(context?: ImageRouteContext): boolean {
  return resolveOpenAiCredentials(context?.userId) !== null;
}

export const openaiProvider: ImageProvider = {
  name: "openai",
  supports: (modelId, operation, context) => {
    if (!openAiAvailable(context)) return false;

    if (operation === "edit" || operation === "variation") {
      return usesDalle2(modelId);
    }

    return ["omni-v2", "latest-v2-pro", "dall-e-3", "dall-e-2"].includes(
      modelId,
    );
  },
  async generate(params: GenerateParams): Promise<GenerateResult> {
    const creds = resolveOpenAiCredentials(params.userId);
    if (!creds) throw new Error("OPENAI_API_KEY not configured");

    const model =
      process.env.OPENAI_IMAGE_MODEL ??
      (params.modelId.includes("pro") ? "dall-e-3" : "dall-e-2");
    const size = usesDalle3(model)
      ? resolveOpenAiSize(params.resolution, params.aspectRatio ?? "1:1")
      : "1024x1024";

    const urls: string[] = [];
    const useB64 = usesDalle3(model);

    for (let i = 0; i < params.count; i++) {
      const res = await fetch(`${creds.baseUrl}/images/generations`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.apiKey}`,
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
        urls.push((await saveGeneratedImage(buffer, "image/png")).url);
      } else if (item?.url) {
        urls.push(item.url);
      } else {
        throw new Error("OpenAI returned no image data");
      }
    }

    return { urls, provider: "openai" };
  },
  async edit(params: EditParams): Promise<GenerateResult> {
    const creds = resolveOpenAiCredentials(params.userId);
    if (!creds) throw new Error("OPENAI_API_KEY not configured");

    const model = "dall-e-2";
    const urls: string[] = [];

    for (let i = 0; i < params.count; i++) {
      const res = await fetch(`${creds.baseUrl}/images/edits`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.apiKey}`,
        },
        body: JSON.stringify({
          model,
          image: params.image,
          mask: params.mask,
          prompt: params.prompt.slice(0, 1000),
          n: 1,
          size: "1024x1024",
          response_format: "url",
        }),
        signal: AbortSignal.timeout(120_000),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenAI Edit API error: ${res.status} ${err.slice(0, 500)}`);
      }

      const json = (await res.json()) as {
        data?: { url?: string }[];
      };
      const url = json.data?.[0]?.url;
      if (!url) throw new Error("OpenAI Edit returned no image URL");
      urls.push(url);
    }

    return { urls, provider: "openai" };
  },
  async variation(params: VariationParams): Promise<GenerateResult> {
    const creds = resolveOpenAiCredentials(params.userId);
    if (!creds) throw new Error("OPENAI_API_KEY not configured");

    const model = "dall-e-2";
    const urls: string[] = [];

    for (let i = 0; i < params.count; i++) {
      const res = await fetch(`${creds.baseUrl}/images/variations`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.apiKey}`,
        },
        body: JSON.stringify({
          model,
          image: params.image,
          n: 1,
          size: "1024x1024",
          response_format: "url",
        }),
        signal: AbortSignal.timeout(120_000),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(
          `OpenAI Variation API error: ${res.status} ${err.slice(0, 500)}`,
        );
      }

      const json = (await res.json()) as {
        data?: { url?: string }[];
      };
      const url = json.data?.[0]?.url;
      if (!url) throw new Error("OpenAI Variation returned no image URL");
      urls.push(url);
    }

    return { urls, provider: "openai" };
  },
};
