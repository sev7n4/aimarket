/**
 * OpenAI Images API 变体工具（POST /images/variations）
 * auto / openai 模式下，有 OPENAI_API_KEY 时优先于 Seedream 模拟变体。
 */
import { variationImage } from "../registry.js";
import { userHasByokOpenAi } from "../../lib/user-provider-config.js";
import type { ImageToolProvider, ToolRunParams, ToolRunResult } from "./types.js";

function resolveMode(): "openai" | "mock" | "auto" | "http" | "seedream" {
  const raw = (process.env.TOOL_VARIATION_PROVIDER ?? "auto").toLowerCase();
  if (
    raw === "openai" ||
    raw === "mock" ||
    raw === "http" ||
    raw === "seedream"
  ) {
    return raw;
  }
  return "auto";
}

async function resolveImagePayload(url: string): Promise<string> {
  if (url.startsWith("data:")) return url;
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) {
    throw new Error(`无法读取源图 (${res.status})`);
  }
  const mime = res.headers.get("content-type") ?? "image/png";
  const buf = Buffer.from(await res.arrayBuffer());
  return `data:${mime};base64,${buf.toString("base64")}`;
}

function openAiAvailable(userId?: string): boolean {
  return (
    Boolean(process.env.OPENAI_API_KEY?.trim()) ||
    Boolean(userId && userHasByokOpenAi(userId))
  );
}

export const variationOpenaiToolProvider: ImageToolProvider = {
  name: "tool-openai-variation",
  supports(toolId: string, userId?: string) {
    if (toolId !== "variation") return false;
    const mode = resolveMode();
    if (mode === "mock" || mode === "http" || mode === "seedream") return false;
    if (mode === "openai") {
      return openAiAvailable(userId);
    }
    return openAiAvailable(userId);
  },
  async run(params: ToolRunParams): Promise<ToolRunResult> {
    const source = params.referenceUrls[0];
    if (!source) {
      throw new Error("变体生成需要源图片");
    }
    const image = await resolveImagePayload(source);
    const result = await variationImage({
      modelId: "dall-e-2",
      image,
      count: params.count ?? 1,
      resolution: params.resolution,
      aspectRatio: params.aspectRatio ?? "1:1",
      userId: params.userId,
    });
    return {
      urls: result.urls,
      provider: result.provider,
      variant: "variation",
    };
  },
};
