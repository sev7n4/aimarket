#!/usr/bin/env node
/**
 * 生产：指定画布会话素材 × 三种视频参考模式端到端生成
 * SESSION_ID=e10ab86a-... node scripts/test-prod-video-three-modes-session.mjs
 */
const API = process.env.API_URL ?? "http://119.29.173.89:4100";
const EMAIL = process.env.PROD_EMAIL ?? "user001@163.com";
const PASSWORD = process.env.PROD_PASSWORD ?? "11111111";
const SESSION_ID =
  process.env.SESSION_ID ?? "e10ab86a-8457-465d-8329-cc01886071b3";
const MODEL_ID = process.env.VIDEO_MODEL ?? "wan-2.6";
const POLL_MS = 15_000;
const JOB_TIMEOUT_MS = Number(process.env.JOB_TIMEOUT_MS ?? 1_200_000);

const CASES = [
  {
    modeId: "omni",
    tag: "全能参考",
    prompt:
      "写实摄影风格，柔和日光。参考 @图片1 的猫咪外观与场景，猫咪在窗台上慵懒打哈欠，毛发细节清晰，固定镜头。",
    buildRefs: (assetId) => [
      { assetId, mediaType: "image", role: "reference" },
    ],
  },
  {
    modeId: "first-last",
    tag: "首尾帧",
    prompt:
      "从首帧画面开始，镜头缓慢推近猫咪面部，猫咪轻轻眨眼，背景虚化，电影感运镜。",
    buildRefs: (assetId) => [
      { assetId, mediaType: "image", role: "first_frame" },
    ],
  },
  {
    modeId: "smart-multi-frame",
    tag: "智能多帧",
    prompt: "多镜头叙事：先全景展示猫咪在窗台，再推近特写。",
    buildShots: (assetId) => [
      { order: 0, assetId, motionPrompt: "全景固定，猫咪在窗台打哈欠" },
      { order: 1, motionPrompt: "镜头缓慢推近，猫眼特写，轻轻眨眼" },
    ],
  },
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
  if (!res.ok) {
    throw new Error(
      `${method} ${path} ${res.status}: ${json.message ?? json.error?.message ?? JSON.stringify(json).slice(0, 200)}`,
    );
  }
  return json.data ?? json;
}

function absUrl(path) {
  if (path.startsWith("http")) return path;
  return `${API}${path.startsWith("/") ? "" : "/"}${path}`;
}

async function resolveSessionAssets(token, sessionId) {
  const bundle = await api(`/api/v1/imageSession/${sessionId}/canvas-bundle`, {
    token,
  });
  const fromLayout = (bundle.layout?.items ?? []).filter(
    (i) => i.url && !i.isVideo,
  );
  const fromMsgs = (bundle.messages ?? [])
    .flatMap((m) => m.outputs ?? [])
    .filter((o) => o.url && !/\.(mp4|webm|mov)(\?|$)/i.test(o.url))
    .map((o, i) => ({
      url: o.url,
      assetId: o.assetId,
      label: `画布图${i + 1}`,
    }));
  const raw = [...fromLayout, ...fromMsgs];
  const seen = new Set();
  const assets = [];
  for (const item of raw) {
    const key = item.url;
    if (seen.has(key)) continue;
    seen.add(key);
    if (item.assetId) {
      assets.push({ assetId: item.assetId, previewUrl: item.url });
      continue;
    }
    const reg = await api("/api/v1/assets/register-url", {
      token,
      method: "POST",
      body: {
        sessionId,
        url: absUrl(item.url),
        fileName: item.label ?? "canvas-ref.png",
      },
    });
    assets.push({ assetId: reg.id, previewUrl: reg.url ?? item.url });
  }
  return assets;
}

function buildPayload(sessionId, assetId, c) {
  const base = {
    sessionId,
    modelId: MODEL_ID,
    count: 1,
    resolution: "1k",
    aspectRatio: "16:9",
    videoResolution: "720P",
    durationSec: 5,
    referenceMode: c.modeId,
    sourceLane: "video",
    prompt: c.prompt,
  };
  if (c.modeId === "smart-multi-frame") {
    return { ...base, smartMultiShots: c.buildShots(assetId) };
  }
  return { ...base, videoReferences: c.buildRefs(assetId) };
}

async function pollJob(token, jobId) {
  const started = Date.now();
  while (Date.now() - started < JOB_TIMEOUT_MS) {
    const job = await api(`/api/v1/ai/jobs/${jobId}`, { token });
    if (["completed", "failed", "cancelled", "succeeded"].includes(job.status)) {
      return job;
    }
    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error(`timeout ${JOB_TIMEOUT_MS}ms`);
}

async function main() {
  console.log(`\n生产视频三模式复测`);
  console.log(`API=${API} session=${SESSION_ID} model=${MODEL_ID}\n`);

  const token = (await api("/api/v1/auth/login", {
    method: "POST",
    body: { email: EMAIL, password: PASSWORD },
  })).token;

  await api("/api/v1/imageSession/ensure", {
    token,
    method: "POST",
    body: { sessionId: SESSION_ID, mode: "chat", kind: "canvas" },
  });

  const assets = await resolveSessionAssets(token, SESSION_ID);
  if (!assets.length) {
    console.error("会话无可用图片素材");
    process.exit(1);
  }
  const primary = assets[0];
  console.log(
    `素材: ${assets.length} 张，主参考 assetId=${primary.assetId} url=${primary.previewUrl.slice(0, 60)}…\n`,
  );

  const summary = [];
  for (const c of CASES) {
    const started = Date.now();
    process.stdout.write(`▶ ${c.tag} (${c.modeId}) … `);
    try {
      const payload = buildPayload(SESSION_ID, primary.assetId, c);
      const submit = await api("/api/v1/ai/generate/video", {
        token,
        method: "POST",
        body: payload,
      });
      process.stdout.write(`job=${submit.jobId} `);
      const job = await pollJob(token, submit.jobId);
      const out = (job.outputs ?? [])[0];
      const url = out?.url ?? "";
      const sec = Math.round((Date.now() - started) / 1000);
      const ok =
        (job.status === "succeeded" || job.status === "completed") &&
        url &&
        /\.(mp4|webm|mov)(\?|$)/i.test(url);
      summary.push({
        tag: c.tag,
        modeId: c.modeId,
        ok,
        status: job.status,
        sec,
        url,
        error: job.error,
      });
      console.log(
        `\n  ${ok ? "✓" : "✗"} ${c.tag}: ${job.status} ${sec}s ${url ? absUrl(url) : job.error ?? "无输出"}`,
      );
    } catch (e) {
      summary.push({
        tag: c.tag,
        modeId: c.modeId,
        ok: false,
        error: e.message,
      });
      console.log(`\n  ✗ ${c.tag}: ${e.message}`);
    }
  }

  console.log("\n── 汇总 ──");
  for (const s of summary) {
    console.log(
      `${s.ok ? "✓" : "✗"} ${s.tag} (${s.modeId})${s.sec ? ` ${s.sec}s` : ""}${s.url ? `\n    ${absUrl(s.url)}` : s.error ? `\n    ${s.error}` : ""}`,
    );
  }
  const passed = summary.filter((s) => s.ok).length;
  console.log(`\n${passed}/${summary.length} 模式生成成功\n`);
  process.exit(passed === summary.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
