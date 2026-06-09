#!/usr/bin/env node
/**
 * 查询 Agnes 侧视频任务状态（用于超时排查）
 *
 * AGNES_API_KEY=sk-... node scripts/diagnose-agnes-video-task.mjs task_xxx
 * 或在服务器：cd /opt/aimarket && set -a && source .env && node scripts/diagnose-agnes-video-task.mjs task_xxx
 */
const taskId = process.argv[2]?.trim();
if (!taskId) {
  console.error("用法: node scripts/diagnose-agnes-video-task.mjs <task_id>");
  process.exit(1);
}

const apiKey = process.env.AGNES_API_KEY?.trim();
const base = (
  process.env.AGNES_API_BASE_URL ?? "https://apihub.agnes-ai.com/v1"
).replace(/\/$/, "");

if (!apiKey) {
  console.error("需要 AGNES_API_KEY");
  process.exit(1);
}

const res = await fetch(`${base}/videos/${encodeURIComponent(taskId)}`, {
  headers: { Authorization: `Bearer ${apiKey}` },
});
const text = await res.text();
if (!res.ok) {
  console.error(`HTTP ${res.status}: ${text.slice(0, 500)}`);
  process.exit(1);
}

const json = JSON.parse(text);
const url =
  json.video_url ||
  (typeof json.remixed_from_video_id === "string" &&
  /^https?:\/\//.test(json.remixed_from_video_id)
    ? json.remixed_from_video_id
    : null) ||
  json.output_url ||
  null;

console.log(
  JSON.stringify(
    {
      taskId,
      status: json.status,
      progress: json.progress ?? null,
      videoUrl: url,
      error: json.error ?? null,
      model: json.model ?? null,
      created_at: json.created_at ?? null,
    },
    null,
    2,
  ),
);
