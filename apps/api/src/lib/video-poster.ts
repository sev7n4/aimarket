import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { AppError } from "./errors.js";
import { getApiPublicBase, toPublicAssetUrl } from "./public-url.js";
import { resolveLocalMediaPath } from "./media-path.js";
import { saveUpload } from "./storage.js";

const execFileAsync = promisify(execFile);

const VIDEO_EXT_RE = /\.(mp4|webm|mov)(\?|$)/i;

export function isVideoMediaUrl(url: string): boolean {
  return VIDEO_EXT_RE.test(url.trim());
}

/** Agnes 等上游偶发返回 metadata 伪 mp4，浏览器无法解码 */
export function isSuspectNonPlayableVideoUrl(url: string): boolean {
  const lower = url.toLowerCase();
  if (/-metadata[_-]/i.test(lower)) return true;
  if (lower.includes("metadata_user")) return true;
  return false;
}

export async function ffmpegAvailable(): Promise<boolean> {
  try {
    await execFileAsync("ffmpeg", ["-version"], { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

function isLocalUploadVideoUrl(url: string): boolean {
  const base = getApiPublicBase().replace(/\/$/, "");
  return url.startsWith(base) && url.includes("/uploads/") && isVideoMediaUrl(url);
}

/** 将外链视频下载到本地上传目录，便于画廊播放与抽帧 */
export async function rehostRemoteVideo(
  videoUrl: string,
): Promise<{ url: string; sizeBytes: number }> {
  if (isSuspectNonPlayableVideoUrl(videoUrl)) {
    throw new AppError(
      400,
      "INVALID_VIDEO_URL",
      "视频地址无效（疑似元数据文件），无法托管",
    );
  }
  const normalized = toPublicAssetUrl(videoUrl);
  if (isLocalUploadVideoUrl(normalized)) {
    return { url: normalized, sizeBytes: 0 };
  }

  const media = await resolveLocalMediaPath(normalized);
  try {
    const buffer = await fs.readFile(media.filePath);
    const saved = await saveUpload(
      buffer,
      "video/mp4",
      `inspiration-video-${randomUUID()}.mp4`,
      { lane: "video" },
    );
    return {
      url: toPublicAssetUrl(saved.url),
      sizeBytes: saved.sizeBytes,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new AppError(
      400,
      "VIDEO_REHOST_FAILED",
      `视频托管失败：${msg.slice(0, 200)}`,
    );
  } finally {
    await media.cleanup();
  }
}

/** 用 FFmpeg 从视频抽一帧并入库，返回公网 poster URL */
export async function extractVideoPosterFrame(
  videoUrl: string,
): Promise<{ url: string; sizeBytes: number }> {
  if (isSuspectNonPlayableVideoUrl(videoUrl)) {
    throw new AppError(
      400,
      "INVALID_VIDEO_URL",
      "视频地址无效（疑似元数据文件），无法生成封面",
    );
  }
  if (!(await ffmpegAvailable())) {
    throw new AppError(
      503,
      "FFMPEG_UNAVAILABLE",
      "服务器未安装 FFmpeg，暂无法生成视频封面",
    );
  }

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "aimarket-poster-"));
  const media = await resolveLocalMediaPath(videoUrl);
  const framePath = path.join(workDir, `${randomUUID()}.jpg`);

  try {
    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-ss",
        "0.5",
        "-i",
        media.filePath,
        "-frames:v",
        "1",
        "-q:v",
        "2",
        framePath,
      ],
      { timeout: 120_000 },
    );
    const buffer = await fs.readFile(framePath);
    const saved = await saveUpload(
      buffer,
      "image/jpeg",
      `inspiration-poster-${randomUUID()}.jpg`,
    );
    return {
      url: toPublicAssetUrl(saved.url),
      sizeBytes: saved.sizeBytes,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new AppError(
      400,
      "POSTER_EXTRACT_FAILED",
      `视频封面抽帧失败：${msg.slice(0, 200)}`,
    );
  } finally {
    await media.cleanup();
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
