import type { VideoMediaType } from "@/lib/creation-dock-prefs";

/** 由 URL 推断媒体类型（登记素材仅有 previewUrl 时的兜底） */
export function inferMediaTypeFromUrl(url: string): VideoMediaType {
  const lower = url.toLowerCase();
  if (/\.(mp4|webm|mov)(\?|$)/.test(lower)) return "video";
  if (/\.(mp3|wav|m4a|ogg|aac|flac)(\?|$)/.test(lower)) return "audio";
  return "image";
}

export function normalizeVideoRefPreviewUrl(url: string): string {
  if (
    url.startsWith("http") ||
    url.startsWith("blob:") ||
    url.startsWith("data:")
  ) {
    return url;
  }
  // 延迟 import 避免循环依赖；调用方多数已用 assetUrl
  return url;
}
