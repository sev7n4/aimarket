import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AppError } from "./errors.js";
import { getApiPublicBase } from "./public-url.js";
import { getUploadDir } from "./storage.js";

/** 将公网 /uploads 或远程 URL 解析为本地可读路径（供 FFmpeg 等使用） */
export async function resolveLocalMediaPath(
  url: string,
): Promise<{ filePath: string; cleanup: () => Promise<void> }> {
  const trimmed = url.trim();
  const publicBase = getApiPublicBase().replace(/\/$/, "");
  let pathname = trimmed;
  if (trimmed.startsWith(publicBase)) {
    pathname = trimmed.slice(publicBase.length);
  }
  if (!pathname.startsWith("/")) {
    try {
      pathname = new URL(trimmed).pathname;
    } catch {
      throw new AppError(400, "INVALID_URL", "无法解析媒体地址");
    }
  }
  if (pathname.startsWith("/uploads/")) {
    const localPath = path.join(getUploadDir(), path.basename(pathname));
    try {
      await fs.access(localPath);
    } catch {
      throw new AppError(404, "NOT_FOUND", "媒体文件不存在");
    }
    return { filePath: localPath, cleanup: async () => {} };
  }

  const ext = path.extname(pathname) || ".bin";
  const tmpPath = path.join(os.tmpdir(), `aimarket-media-${randomUUID()}${ext}`);
  const res = await fetch(trimmed, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) {
    throw new AppError(
      502,
      "MEDIA_DOWNLOAD_FAILED",
      `下载媒体失败 (${res.status})`,
    );
  }
  await fs.writeFile(tmpPath, Buffer.from(await res.arrayBuffer()));
  return {
    filePath: tmpPath,
    cleanup: async () => {
      await fs.unlink(tmpPath).catch(() => {});
    },
  };
}
