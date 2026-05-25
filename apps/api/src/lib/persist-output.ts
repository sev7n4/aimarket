import { persistRemoteImageUrl } from "./storage.js";

/** 将 http(s) 外链转为本地 `/uploads/`，避免临时 URL 失效 */
export async function persistOutputUrls(urls: string[]): Promise<string[]> {
  const persisted: string[] = [];
  for (const url of urls) {
    const cdn = process.env.S3_PUBLIC_URL?.replace(/\/$/, "");
    if (
      url.startsWith("/uploads/") ||
      (cdn && url.startsWith(cdn))
    ) {
      persisted.push(url);
      continue;
    }
    if (url.startsWith("http://") || url.startsWith("https://")) {
      persisted.push(await persistRemoteImageUrl(url));
      continue;
    }
    persisted.push(url);
  }
  return persisted;
}
