import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { AppError } from "./errors.js";
import { getApiPublicBase } from "./public-url.js";
import { getUploadDir, saveUpload } from "./storage.js";

const execFileAsync = promisify(execFile);

async function ffmpegAvailable(): Promise<boolean> {
  try {
    await execFileAsync("ffmpeg", ["-version"], { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

async function resolveLocalMediaPath(
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

/** 使用 FFmpeg 将 BGM 混入视频（保留原画面，替换/叠加音轨） */
export async function muxVideoWithBgm(
  videoUrl: string,
  audioUrl: string,
): Promise<{ url: string; sizeBytes: number; mimeType: string }> {
  if (!(await ffmpegAvailable())) {
    throw new AppError(
      503,
      "FFMPEG_UNAVAILABLE",
      "服务器未安装 FFmpeg，暂无法合成 BGM",
    );
  }

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "aimarket-bgm-"));
  const video = await resolveLocalMediaPath(videoUrl);
  const audio = await resolveLocalMediaPath(audioUrl);
  const outPath = path.join(workDir, `${randomUUID()}.mp4`);

  try {
    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-i",
        video.filePath,
        "-i",
        audio.filePath,
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
        outPath,
      ],
      { timeout: 300_000 },
    );

    const buffer = await fs.readFile(outPath);
    const saved = await saveUpload(
      buffer,
      "video/mp4",
      `bgm-mux-${randomUUID()}.mp4`,
      { lane: "video" },
    );
    return {
      url: saved.url,
      sizeBytes: saved.sizeBytes,
      mimeType: "video/mp4",
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new AppError(
      500,
      "BGM_MUX_FAILED",
      `BGM 合成失败：${msg.slice(0, 200)}`,
    );
  } finally {
    await video.cleanup();
    await audio.cleanup();
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
