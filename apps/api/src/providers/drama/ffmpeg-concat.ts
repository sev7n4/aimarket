import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { resolveLocalMediaPath } from "../../lib/media-path.js";
import { saveUpload } from "../../lib/storage.js";
import { ffmpegAvailable } from "../../lib/video-poster.js";
import type { ConcatParams, ConcatResult } from "./types.js";

const execFileAsync = promisify(execFile);

function buildSrt(
  subtitles: ConcatParams["subtitles"],
): string {
  if (!subtitles?.length) return "";
  return subtitles
    .map((s, i) => {
      const start = formatSrtTime(s.startSec);
      const end = formatSrtTime(s.endSec);
      return `${i + 1}\n${start} --> ${end}\n${s.text}\n`;
    })
    .join("\n");
}

function formatSrtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

/** FFmpeg 拼接多镜 + 可选字幕烧录 */
export async function concatClipsFfmpeg(
  params: ConcatParams,
): Promise<ConcatResult> {
  if (!(await ffmpegAvailable())) {
    throw new Error("FFMPEG_UNAVAILABLE");
  }

  const clips = params.clipUrls.filter(Boolean);
  if (!clips.length) {
    throw new Error("无视频片段可拼接");
  }
  if (clips.length === 1 && !params.subtitles?.length) {
    return { url: clips[0]!, provider: "ffmpeg-pass-through" };
  }

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "aimarket-drama-"));
  const localClips: Array<{ filePath: string; cleanup: () => Promise<void> }> =
    [];

  try {
    for (let i = 0; i < clips.length; i++) {
      const resolved = await resolveLocalMediaPath(clips[i]!);
      const dest = path.join(workDir, `clip-${i}.mp4`);
      await fs.copyFile(resolved.filePath, dest);
      localClips.push(resolved);
    }

    const listPath = path.join(workDir, "concat.txt");
    const listContent = clips
      .map((_, i) => `file 'clip-${i}.mp4'`)
      .join("\n");
    await fs.writeFile(listPath, listContent);

    const mergedPath = path.join(workDir, "merged.mp4");
    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        listPath,
        "-c",
        "copy",
        mergedPath,
      ],
      { cwd: workDir, timeout: 600_000 },
    );

    let finalPath = mergedPath;
    const srt = buildSrt(params.subtitles);
    if (srt) {
      const srtPath = path.join(workDir, "subs.srt");
      await fs.writeFile(srtPath, srt, "utf8");
      const burnedPath = path.join(workDir, "final.mp4");
      await execFileAsync(
        "ffmpeg",
        [
          "-y",
          "-i",
          mergedPath,
          "-vf",
          `subtitles=${srtPath.replace(/'/g, "'\\''")}`,
          "-c:a",
          "copy",
          burnedPath,
        ],
        { timeout: 600_000 },
      );
      finalPath = burnedPath;
    }

    const buffer = await fs.readFile(finalPath);
    const saved = await saveUpload(
      buffer,
      "video/mp4",
      `drama-final-${randomUUID()}.mp4`,
      { lane: "video" },
    );
    return { url: saved.url, provider: "ffmpeg-concat" };
  } finally {
    for (const c of localClips) {
      await c.cleanup().catch(() => {});
    }
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

export function isFfmpegConcatAvailable(): boolean {
  return true;
}
