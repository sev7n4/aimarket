/**
 * AI 音乐生成 Provider
 *
 * 支持两种模式：
 * 1. Suno API：当 SUNO_API_KEY 配置时，调用 Suno 生成音乐
 * 2. Mock fallback：使用 ffmpeg 生成正弦波音频，持久化为本地文件
 */

import { execFile } from "node:child_process";
import { mkdir, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { saveUpload } from "../lib/storage.js";

/** 音乐生成参数 */
export interface MusicGenParams {
  /** 风格描述，如 "轻快电子乐"、"忧伤钢琴" */
  style: string;
  /** 节拍速度（BPM） */
  bpm: number;
  /** 时长（秒） */
  durationSec: number;
}

/** 音乐生成结果 */
export interface MusicGenResult {
  /** 生成音频的持久化 URL */
  audioUrl: string;
  /** 实际时长（秒） */
  durationSec: number;
  /** 使用的 provider 名称 */
  provider: string;
}

const SUNO_API_KEY = () => process.env.SUNO_API_KEY?.trim();
const SUNO_API_URL = () =>
  process.env.SUNO_API_URL?.trim() || "https://api.suno.ai/v1";
const IMAGE_PROVIDER = () => process.env.IMAGE_PROVIDER?.trim();

/** 使用 ffmpeg 生成一段正弦波音频并持久化 */
async function generateMockAudio(params: MusicGenParams): Promise<MusicGenResult> {
  const workDir = join(tmpdir(), `music-mock-${randomUUID()}`);
  await mkdir(workDir, { recursive: true });
  const outputPath = join(workDir, `mock-${params.bpm}bpm-${params.durationSec}s.mp3`);

  // 频率映射：根据 BPM 计算基频（简化映射）
  const baseFreq = 220 + (params.bpm - 60) * 2;

  try {
    await new Promise<void>((resolve, reject) => {
      execFile(
        "ffmpeg",
        [
          "-y",
          "-f", "lavfi",
          "-i", `sine=frequency=${baseFreq}:duration=${params.durationSec}`,
          "-af", `atempo=1.0`,
          "-c:a", "libmp3lame",
          "-q:a", "6",
          outputPath,
        ],
        { timeout: 30_000 },
        (err) => {
          if (err) return reject(new Error(`ffmpeg 生成 mock 音频失败: ${err.message}`));
          resolve();
        },
      );
    });

    // 读取生成的音频文件并持久化
    const buffer = await readFile(outputPath);
    const saved = await saveUpload(buffer, "audio/mpeg", `music-mock-${Date.now()}.mp3`, { lane: "video" });

    return {
      audioUrl: saved.url,
      durationSec: params.durationSec,
      provider: "music-gen-mock",
    };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

/** 调用 Suno API 生成音乐 */
async function generateSunoAudio(params: MusicGenParams): Promise<MusicGenResult> {
  const apiKey = SUNO_API_KEY();
  const apiUrl = SUNO_API_URL();

  // 步骤 1：提交生成请求
  const genRes = await fetch(`${apiUrl}/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      prompt: params.style,
      tags: `${params.style}, ${params.bpm} BPM`,
      duration: params.durationSec,
    }),
  });

  if (!genRes.ok) {
    const text = await genRes.text().catch(() => "");
    throw new Error(`Suno API 生成请求失败 (${genRes.status}): ${text}`);
  }

  const genData = await genRes.json() as { id?: string; status?: string; audio_url?: string };
  const taskId = genData.id;

  if (!taskId) {
    throw new Error("Suno API 未返回任务 ID");
  }

  // 步骤 2：轮询等待完成
  const pollIntervalMs = 3000;
  const maxPollMs = 300_000; // 5 分钟超时
  const deadline = Date.now() + maxPollMs;

  let audioUrl: string | undefined;
  while (Date.now() < deadline) {
    const pollRes = await fetch(`${apiUrl}/generate/${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!pollRes.ok) {
      throw new Error(`Suno API 轮询失败 (${pollRes.status})`);
    }

    const pollData = await pollRes.json() as {
      status?: string;
      audio_url?: string;
      error_message?: string;
    };

    if (pollData.status === "completed" && pollData.audio_url) {
      audioUrl = pollData.audio_url;
      break;
    }

    if (pollData.status === "failed" || pollData.status === "error") {
      throw new Error(`Suno 生成失败: ${pollData.error_message ?? "未知错误"}`);
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  if (!audioUrl) {
    throw new Error("Suno 生成超时");
  }

  // 步骤 3：下载音频并持久化
  const audioRes = await fetch(audioUrl, { signal: AbortSignal.timeout(60_000) });
  if (!audioRes.ok) {
    throw new Error(`下载 Suno 音频失败 (${audioRes.status})`);
  }
  const audioMime =
    audioRes.headers.get("content-type")?.split(";")[0]?.trim() ?? "audio/mpeg";
  const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
  const saved = await saveUpload(audioBuffer, audioMime, `music-suno-${Date.now()}.mp3`, { lane: "video" });
  const persistedUrl = saved.url;

  return {
    audioUrl: persistedUrl,
    durationSec: params.durationSec,
    provider: "suno",
  };
}

/**
 * 生成音乐
 *
 * 优先级：
 * 1. IMAGE_PROVIDER=mock 时使用 mock
 * 2. SUNO_API_KEY 已配置时调用 Suno API
 * 3. 无 Suno key 时降级到 mock（ffmpeg 正弦波）
 */
export async function generateMusic(params: MusicGenParams): Promise<MusicGenResult> {
  console.log(
    `[music-gen] 收到请求：style="${params.style}" bpm=${params.bpm} durationSec=${params.durationSec}`,
  );

  const imageProvider = IMAGE_PROVIDER();
  const sunoKey = SUNO_API_KEY();

  // 显式 mock 模式或无 Suno key 时使用 mock
  if (imageProvider === "mock" || !sunoKey) {
    console.log("[music-gen] 使用 mock 模式生成音频");
    return generateMockAudio(params);
  }

  // 有 Suno key，调用真实 API
  console.log("[music-gen] 调用 Suno API 生成音频");
  try {
    return await generateSunoAudio(params);
  } catch (err) {
    console.warn("[music-gen] Suno API 调用失败，降级到 mock:", err instanceof Error ? err.message : err);
    return generateMockAudio(params);
  }
}
