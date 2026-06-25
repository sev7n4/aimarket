#!/usr/bin/env node
/** 补跑未完成的 5 个视频矩阵用例 */
import { randomUUID } from "node:crypto";

const API = process.env.API_URL ?? "http://119.29.173.89:4100";
const EMAIL = process.env.PROD_EMAIL ?? "user001@163.com";
const PASSWORD = process.env.PROD_PASSWORD ?? "11111111";
const POLL_MS = 15_000;
const JOB_TIMEOUT_MS = Number(process.env.JOB_TIMEOUT_MS ?? 1_200_000);

const CASES = [
  { modelId: "seedance-2", modeId: "first-last", tag: "seedance-first-last" },
  { modelId: "seedance-2", modeId: "smart-multi-frame", tag: "seedance-smart" },
  { modelId: "wan-2.6", modeId: "omni", tag: "wan-omni" },
  { modelId: "wan-2.6", modeId: "first-last", tag: "wan-first-last" },
  { modelId: "wan-2.6", modeId: "smart-multi-frame", tag: "wan-smart" },
];

async function api(path, { token, method = "GET", body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(180_000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} ${res.status}: ${json.message ?? JSON.stringify(json).slice(0,200)}`);
  return json.data ?? json;
}

function buildPayload({ sessionId, modelId, modeId, assetId, tag }) {
  const base = {
    sessionId, modelId, count: 1, resolution: "1k", aspectRatio: "16:9",
    videoResolution: "720P", durationSec: 5, referenceMode: modeId, sourceLane: "video",
    prompt: `[E2E-${tag}] 写实风格，固定镜头，橘猫在窗台打哈欠`,
  };
  if (modeId === "omni") {
    return { ...base, prompt: `${base.prompt}，参考 @图片1`, videoReferences: [{ assetId, mediaType: "image", role: "reference" }] };
  }
  if (modeId === "first-last") {
    return { ...base, videoReferences: [{ assetId, mediaType: "image", role: "first_frame" }] };
  }
  return {
    ...base,
    smartMultiShots: [
      { order: 0, assetId, motionPrompt: "全景固定，猫打哈欠" },
      { order: 1, motionPrompt: "推近猫眼特写" },
    ],
  };
}

async function pollJob(token, jobId) {
  const started = Date.now();
  while (Date.now() - started < JOB_TIMEOUT_MS) {
    const job = await api(`/api/v1/ai/jobs/${jobId}`, { token });
    if (["completed", "failed", "cancelled", "succeeded"].includes(job.status)) return job;
    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error(`timeout ${JOB_TIMEOUT_MS}ms`);
}

async function main() {
  const token = (await api("/api/v1/auth/login", { method: "POST", body: { email: EMAIL, password: PASSWORD } })).token;
  const sessionId = randomUUID();
  await api("/api/v1/imageSession/ensure", { token, method: "POST", body: { sessionId, mode: "chat", kind: "canvas" } });
  const assetId = (await api("/api/v1/assets/register-url", {
    token, method: "POST", body: { sessionId, url: "https://picsum.photos/seed/aimarket-video-e2e/768/432", fileName: "e2e.jpg" },
  })).id;

  for (const c of CASES) {
    const started = Date.now();
    try {
      const submit = await api("/api/v1/ai/generate/video", { token, method: "POST", body: buildPayload({ sessionId, ...c, assetId }) });
      console.log(`\n▶ ${c.tag} job=${submit.jobId}`);
      const job = await pollJob(token, submit.jobId);
      const url = (job.outputs ?? [])[0]?.url ?? "";
      const sec = Math.round((Date.now() - started) / 1000);
      console.log(`\n  ← ${c.tag}: ${job.status} ${sec}s ${url ? url.slice(0,70) : job.error ?? ""}`);
    } catch (e) {
      console.log(`\n  ← ${c.tag}: error ${e.message}`);
    }
  }
}

main();
