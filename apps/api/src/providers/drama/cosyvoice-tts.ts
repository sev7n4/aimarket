import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { saveUpload } from "../../lib/storage.js";
import type { TtsParams, TtsResult } from "./types.js";

const COSYVOICE_MODEL = "cosyvoice-v1";

/** 阿里云 DashScope CosyVoice TTS */
export async function synthesizeCosyVoice(params: TtsParams): Promise<TtsResult> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new Error("DASHSCOPE_API_KEY missing for CosyVoice");
  }

  const voice =
    params.voiceStyle === "爽朗"
      ? "longxiaochun"
      : params.voiceStyle === "温柔坚定"
        ? "longxiaoxia"
        : process.env.DRAMA_TTS_VOICE ?? "longxiaochun";

  const base =
    process.env.DASHSCOPE_TTS_BASE_URL ??
    "https://dashscope.aliyuncs.com/api/v1/services/audio/tts";

  const res = await fetch(base, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-DashScope-Async": "enable",
    },
    body: JSON.stringify({
      model: process.env.DRAMA_TTS_MODEL ?? COSYVOICE_MODEL,
      input: { text: params.text },
      parameters: { voice, format: "mp3", sample_rate: 24000 },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CosyVoice HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    output?: { task_id?: string; audio_url?: string };
    request_id?: string;
  };

  let audioUrl = json.output?.audio_url;
  const taskId = json.output?.task_id;

  if (!audioUrl && taskId) {
    audioUrl = await pollCosyVoiceTask(apiKey, taskId);
  }

  if (!audioUrl) {
    throw new Error("CosyVoice 未返回音频 URL");
  }

  const audioRes = await fetch(audioUrl);
  if (!audioRes.ok) {
    throw new Error(`CosyVoice 下载失败 HTTP ${audioRes.status}`);
  }
  const buffer = Buffer.from(await audioRes.arrayBuffer());
  const saved = await saveUpload(
    buffer,
    "audio/mpeg",
    `drama-tts-${randomUUID()}.mp3`,
    { lane: "video" },
  );

  return { url: saved.url, provider: "cosyvoice" };
}

async function pollCosyVoiceTask(
  apiKey: string,
  taskId: string,
): Promise<string | undefined> {
  const statusUrl =
    process.env.DASHSCOPE_TTS_TASK_URL ??
    `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`;
  const deadline = Date.now() + 120_000;

  while (Date.now() < deadline) {
    const res = await fetch(statusUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) break;
    const json = (await res.json()) as {
      output?: { task_status?: string; audio_url?: string };
    };
    const status = json.output?.task_status;
    if (status === "SUCCEEDED" && json.output?.audio_url) {
      return json.output.audio_url;
    }
    if (status === "FAILED") break;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return undefined;
}

export function isCosyVoiceConfigured(): boolean {
  return Boolean(process.env.DASHSCOPE_API_KEY);
}
