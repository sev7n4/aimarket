import { AppError } from "../errors.js";
import { resolveModerationProvider } from "./index.js";
import { localModerationProvider } from "./local.js";
import type { ModerationResult } from "./types.js";

export function isOutputModerationEnabled(): boolean {
  if (process.env.MODERATION_OUTPUT === "false") return false;
  if (process.env.MODERATION_OUTPUT === "true") return true;
  const mode = process.env.MODERATION_PROVIDER ?? "auto";
  if (mode === "local") return false;
  if (mode === "openai" || mode === "http") return true;
  if (process.env.MODERATION_HTTP_URL || process.env.OPENAI_API_KEY) return true;
  return false;
}

async function checkImageOpenAi(url: string): Promise<ModerationResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return localModerationProvider.check(url);
  }

  const base = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(
    /\/$/,
    "",
  );
  const model =
    process.env.OPENAI_MODERATION_MODEL ?? "omni-moderation-latest";

  try {
    const res = await fetch(`${base}/moderations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [{ type: "image_url", image_url: { url } }],
      }),
    });

    if (!res.ok) {
      console.warn("[moderation:openai:image] API error", res.status);
      return { allowed: true, provider: "openai" };
    }

    const json = (await res.json()) as {
      results?: { flagged?: boolean }[];
    };
    const flagged = json.results?.[0]?.flagged === true;
    return { allowed: !flagged, provider: "openai" };
  } catch (err) {
    console.warn("[moderation:openai:image] request failed", err);
    return { allowed: true, provider: "openai" };
  }
}

async function checkImageHttp(url: string): Promise<ModerationResult> {
  const endpoint = process.env.MODERATION_HTTP_URL?.trim();
  if (!endpoint) {
    return localModerationProvider.check(url);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const key = process.env.MODERATION_HTTP_KEY;
  if (key) headers.Authorization = `Bearer ${key}`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ image_url: url, url }),
    });

    if (!res.ok) {
      console.warn("[moderation:http:image] API error", res.status);
      return { allowed: true, provider: "http" };
    }

    const json = (await res.json()) as {
      allowed?: boolean;
      flagged?: boolean;
    };
    if (typeof json.allowed === "boolean") {
      return { allowed: json.allowed, provider: "http" };
    }
    if (typeof json.flagged === "boolean") {
      return { allowed: !json.flagged, provider: "http" };
    }
    return { allowed: true, provider: "http" };
  } catch (err) {
    console.warn("[moderation:http:image] request failed", err);
    return { allowed: true, provider: "http" };
  }
}

async function checkImageUrl(url: string): Promise<ModerationResult> {
  const provider = resolveModerationProvider();
  if (provider.name === "openai") return checkImageOpenAi(url);
  if (provider.name === "http") return checkImageHttp(url);
  return { allowed: true, provider: provider.name };
}

/** 出图后审核：仅对可公网访问的 http(s) URL；mock 本地路径跳过 */
export async function assertOutputsAllowed(urls: string[]) {
  if (!isOutputModerationEnabled()) return;

  const remote = urls.filter((u) => /^https?:\/\//i.test(u));
  if (!remote.length) return;

  for (const url of remote) {
    const result = await checkImageUrl(url);
    if (!result.allowed) {
      throw new AppError(
        400,
        "CONTENT_BLOCKED",
        "生成结果未通过内容审核，请调整描述后重试",
      );
    }
  }
}
