#!/usr/bin/env node
/**
 * Agnes 四能力真实 Key 冒烟（文生图 / 图生图 / 文生视频 / 图生视频）
 * 无 AGNES_API_KEY 时跳过（CI 安全）
 *
 * AGNES_API_KEY=sk-... node scripts/test-agnes-smoke.mjs
 */
const apiKey = process.env.AGNES_API_KEY?.trim();
const base = (
  process.env.AGNES_API_BASE_URL ?? "https://apihub.agnes-ai.com/v1"
).replace(/\/$/, "");
const imageModel =
  process.env.AGNES_IMAGE_MODEL?.trim() || "agnes-image-2.1-flash";
const videoModel =
  process.env.AGNES_VIDEO_MODEL?.trim() || "agnes-video-v2.0";
const pollIntervalMs = Number(process.env.AGNES_VIDEO_POLL_INTERVAL_MS ?? 10_000);
const pollTimeoutMs = Number(process.env.AGNES_VIDEO_POLL_TIMEOUT_MS ?? 900_000);

if (!apiKey) {
  console.log("⊘ test-agnes-smoke: 未配置 AGNES_API_KEY，跳过");
  process.exit(0);
}

const results = [];

function pass(name) {
  results.push({ name, ok: true });
  console.log(`✓ ${name}`);
}
function fail(name, err) {
  results.push({ name, ok: false, err: String(err) });
  console.error(`✗ ${name}: ${err}`);
}

function extractVideoUrl(task) {
  for (const k of ["video_url", "remixed_from_video_id", "output_url"]) {
    const v = task[k];
    if (typeof v === "string" && /^https?:\/\//.test(v)) return v;
  }
  return null;
}

async function pollVideo(taskId, label) {
  const deadline = Date.now() + pollTimeoutMs;
  let lastStatus = "unknown";
  while (Date.now() < deadline) {
    const res = await fetch(`${base}/videos/${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      throw new Error(`poll ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const task = await res.json();
    lastStatus = String(task.status ?? "unknown");
    if (lastStatus === "completed") {
      const url = extractVideoUrl(task);
      if (!url) throw new Error("completed 但无 video URL");
      return url;
    }
    if (lastStatus === "failed") {
      throw new Error(`failed: ${JSON.stringify(task.error ?? task)}`);
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
  throw new Error(`超时 (最后状态 ${lastStatus}, task=${taskId})`);
}

async function fetchJson(url, init, retries = 2) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        ...init,
        signal: init?.signal ?? AbortSignal.timeout(180_000),
      });
      return res;
    } catch (err) {
      lastErr = err;
      if (i < retries) await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw lastErr;
}

async function testT2I() {
  const res = await fetchJson(`${base}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: imageModel,
      prompt: "a red apple on white background, product photo",
      size: "1024x1024",
      n: 1,
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const url = json?.data?.[0]?.url;
  if (!url) throw new Error("无图片 URL");
  return url;
}

async function testI2I(refUrl) {
  const res = await fetchJson(`${base}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: imageModel,
      prompt: "same apple, watercolor style",
      size: "1024x1024",
      n: 1,
      extra_body: { image: refUrl, response_format: "url" },
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const url = json?.data?.[0]?.url;
  if (!url) throw new Error("无图片 URL");
  return url;
}

async function testT2V() {
  const res = await fetchJson(`${base}/videos`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: videoModel,
      prompt: "gentle camera pan over a red apple on a table",
      width: 1152,
      height: 768,
      num_frames: 81,
      frame_rate: 24,
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
  const created = await res.json();
  const taskId = created.id ?? created.task_id;
  if (!taskId) throw new Error("无 task id");
  return pollVideo(taskId, "t2v");
}

async function testI2V(refUrl) {
  const res = await fetchJson(`${base}/videos`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: videoModel,
      prompt: "subtle zoom on the product",
      image: refUrl,
      width: 1152,
      height: 768,
      num_frames: 81,
      frame_rate: 24,
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
  const created = await res.json();
  const taskId = created.id ?? created.task_id;
  if (!taskId) throw new Error("无 task id");
  return pollVideo(taskId, "i2v");
}

console.log(`Agnes 冒烟 base=${base} image=${imageModel} video=${videoModel}`);

let refImageUrl;
try {
  refImageUrl = await testT2I();
  pass("文生图 T2I");
} catch (e) {
  fail("文生图 T2I", e);
}

if (refImageUrl) {
  try {
    await testI2I(refImageUrl);
    pass("图生图 I2I");
  } catch (e) {
    fail("图生图 I2I", e);
  }
}

if (refImageUrl) {
  try {
    await testT2V();
    pass("文生视频 T2V");
  } catch (e) {
    fail("文生视频 T2V", e);
  }
}

if (refImageUrl) {
  try {
    await testI2V(refImageUrl);
    pass("图生视频 I2V");
  } catch (e) {
    fail("图生视频 I2V", e);
  }
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} 通过`);
if (failed.length) {
  for (const f of failed) console.error(`  - ${f.name}: ${f.err}`);
  process.exit(1);
}
