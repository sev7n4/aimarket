import type { LipSyncParams, LipSyncResult } from "./types.js";

/** HeyGen / 自建口型同步 HTTP 网关 */
export async function lipSyncHeyGen(params: LipSyncParams): Promise<LipSyncResult> {
  const url = process.env.DRAMA_LIPSYNC_HTTP_URL ?? process.env.HEYGEN_LIPSYNC_URL;
  if (!url) {
    throw new Error("DRAMA_LIPSYNC_HTTP_URL not configured");
  }

  const apiKey =
    process.env.DRAMA_LIPSYNC_HTTP_KEY ?? process.env.HEYGEN_API_KEY;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      videoUrl: params.videoUrl,
      audioUrl: params.audioUrl,
      jobId: params.jobId,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LipSync HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    url?: string;
    videoUrl?: string;
    outputUrl?: string;
  };

  const out = json.url ?? json.videoUrl ?? json.outputUrl;
  if (!out) {
    throw new Error("LipSync 网关未返回视频 URL");
  }

  return { url: out, provider: "heygen-http" };
}

export function isHeyGenLipSyncConfigured(): boolean {
  return Boolean(
    process.env.DRAMA_LIPSYNC_HTTP_URL ?? process.env.HEYGEN_LIPSYNC_URL,
  );
}
