#!/usr/bin/env node
/**
 * 生产环境视频模型 × 参考模式矩阵复测
 * API_URL=http://119.29.173.89:4100 PROD_EMAIL=... PROD_PASSWORD=... node scripts/test-prod-video-matrix.mjs
 */
import { randomUUID } from "node:crypto";

const API = process.env.API_URL ?? "http://119.29.173.89:4100";
const EMAIL = process.env.PROD_EMAIL ?? "user001@163.com";
const PASSWORD = process.env.PROD_PASSWORD ?? "11111111";
const POLL_MS = 12_000;
const JOB_TIMEOUT_MS = Number(process.env.JOB_TIMEOUT_MS ?? 600_000);

const MODELS = [
  { id: "agnes-video", label: "Agnes Video" },
  { id: "seedance-2", label: "Seedance 2 (Agnes 代理)" },
  { id: "wan-2.6", label: "Wan 2.6" },
];

const MODES = [
  { id: "omni", label: "全能参考" },
  { id: "first-last", label: "首尾帧" },
  { id: "smart-multi-frame", label: "智能多帧" },
];

async function api(path, { token, method = "GET", body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(120_000),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 500) };
  }
  if (!res.ok) {
    const msg =
      json?.message ?? json?.error?.message ?? json?.error ?? text.slice(0, 300);
    throw new Error(`${method} ${path} → ${res.status}: ${msg}`);
  }
  return json.data ?? json;
}

async function login() {
  const data = await api("/api/v1/auth/login", {
    method: "POST",
    body: { email: EMAIL, password: PASSWORD },
  });
  if (!data.token) throw new Error("login failed: no token");
  return data.token;
}

async function ensureSession(token, sessionId) {
  await api("/api/v1/imageSession/ensure", {
    token,
    method: "POST",
    body: { sessionId, mode: "chat", kind: "canvas", title: "视频矩阵复测" },
  });
}

async function registerRefImage(token, sessionId) {
  const data = await api("/api/v1/assets/register-url", {
    token,
    method: "POST",
    body: {
      sessionId,
      url: "https://picsum.photos/seed/aimarket-video-e2e/768/432",
      fileName: "e2e-ref.jpg",
    },
  });
  return data.id;
}

function buildPayload({ sessionId, modelId, modeId, assetId, tag }) {
  const base = {
    sessionId,
    modelId,
    count: 1,
    resolution: "1k",
    aspectRatio: "16:9",
    videoResolution: "720P",
    durationSec: 5,
    referenceMode: modeId,
    sourceLane: "video",
    prompt: `[E2E-${tag}] 写实风格，柔和日光，固定镜头，一只橘猫在窗台上打哈欠`,
  };

  if (modeId === "omni") {
    return {
      ...base,
      prompt: `${base.prompt}，参考 @图片1 的主体外观`,
      videoReferences: [
        { assetId, mediaType: "image", role: "reference" },
      ],
    };
  }

  if (modeId === "first-last") {
    return {
      ...base,
      prompt: `${base.prompt}，从首帧缓慢推近`,
      videoReferences: [
        { assetId, mediaType: "image", role: "first_frame" },
      ],
    };
  }

  return {
    ...base,
    aspectRatio: "16:9",
    videoResolution: "720P",
    smartMultiShots: [
      { order: 0, assetId, motionPrompt: "全景固定，猫打哈欠" },
      { order: 1, motionPrompt: "镜头缓慢推近猫眼特写" },
    ],
  };
}

async function submitVideo(token, payload) {
  const data = await api("/api/v1/ai/generate/video", {
    token,
    method: "POST",
    body: payload,
  });
  return data;
}

async function pollJob(token, jobId) {
  const started = Date.now();
  while (Date.now() - started < JOB_TIMEOUT_MS) {
    const job = await api(`/api/v1/ai/jobs/${jobId}`, { token });
    const status = job.status;
    if (status === "completed" || status === "failed" || status === "cancelled") {
      return job;
    }
    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error(`job ${jobId} timeout after ${JOB_TIMEOUT_MS}ms`);
}

async function runCase(token, sessionId, assetId, model, mode) {
  const tag = `${model.id}-${mode.id}`;
  const started = Date.now();
  const row = {
    model: model.label,
    modelId: model.id,
    mode: mode.label,
    modeId: mode.id,
    status: "error",
    jobId: null,
    elapsedSec: 0,
    videoUrl: null,
    error: null,
    degradation: null,
    provider: null,
  };

  try {
    const payload = buildPayload({
      sessionId,
      modelId: model.id,
      modeId: mode.id,
      assetId,
      tag,
    });
    const submit = await submitVideo(token, payload);
    row.jobId = submit.jobId;
    console.log(`\n▶ ${tag} job=${submit.jobId} est=${submit.estimatedPoints ?? "?"}pts`);
    const job = await pollJob(token, submit.jobId);
    row.elapsedSec = Math.round((Date.now() - started) / 1000);
    row.status = job.status;
    row.error = job.error ?? null;
    const ctx = job.tool_context ?? job.toolContext;
    if (ctx && typeof ctx === "object") {
      row.degradation = ctx.validationHint ?? null;
    }
    const outputs = job.outputs ?? [];
    const video = outputs.find((o) => o.type === "video" || o.mimeType?.startsWith?.("video"));
    row.videoUrl = video?.url ?? outputs[0]?.url ?? null;
    row.provider = job.provider ?? job.routing_provider ?? null;
    if (job.status === "completed" && !row.videoUrl) {
      row.status = "failed";
      row.error = row.error ?? "completed but no video output url";
    }
  } catch (e) {
    row.elapsedSec = Math.round((Date.now() - started) / 1000);
    row.error = e instanceof Error ? e.message : String(e);
    row.status = "error";
  }
  console.log(`\n  ← ${tag}: ${row.status}${row.error ? ` (${row.error.slice(0, 120)})` : ""}`);
  return row;
}

async function main() {
  console.log(`API=${API} user=${EMAIL}`);
  const token = await login();
  const sessionId = randomUUID();
  await ensureSession(token, sessionId);
  const assetId = await registerRefImage(token, sessionId);
  console.log(`session=${sessionId} refAsset=${assetId}`);

  const status = await api("/api/v1/ai/providerStatus", { token });
  const routes = status.video?.modelRoutes ?? [];
  console.log("\n=== 生产视频路由 ===");
  for (const r of routes) {
    console.log(
      `- ${r.modelId}: provider=${r.provider} available=${r.available} caps=${JSON.stringify(r.capabilities)}`,
    );
  }

  const results = [];
  for (const model of MODELS) {
    for (const mode of MODES) {
      results.push(await runCase(token, sessionId, assetId, model, mode));
    }
  }

  console.log("\n\n========== 测试矩阵结论 ==========\n");
  console.log("| 模型 | 模式 | 结果 | 耗时 | JobId | 备注 |");
  console.log("|------|------|------|------|-------|------|");
  for (const r of results) {
    const ok = r.status === "completed" && r.videoUrl;
    const mark = ok ? "✅ 成片" : r.status === "completed" ? "⚠️ 无URL" : "❌ 失败";
    const note = (r.error ?? r.degradation ?? (r.videoUrl ? "ok" : "")).slice(0, 80);
    console.log(
      `| ${r.model} | ${r.mode} | ${mark} | ${r.elapsedSec}s | ${r.jobId?.slice(0, 8) ?? "-"} | ${note} |`,
    );
  }

  const passed = results.filter((r) => r.status === "completed" && r.videoUrl).length;
  console.log(`\n通过: ${passed}/${results.length}`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
