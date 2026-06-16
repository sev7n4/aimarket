#!/usr/bin/env node
import crypto from "node:crypto";
/**
 * AI 短剧规划重跑集成测试（从分镜 Agent 重跑）
 * API_URL=http://localhost:4000 pnpm exec tsx scripts/test-drama-plan-rerun.mjs
 */
const API = process.env.API_URL ?? "http://localhost:4000";

async function request(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(globalThis.__DRAMA_PLAN_RERUN_TOKEN
        ? { Authorization: `Bearer ${globalThis.__DRAMA_PLAN_RERUN_TOKEN}` }
        : {}),
      ...init.headers,
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error?.message ?? `HTTP ${res.status} ${path}`);
  }
  return json.data ?? json;
}

async function pollPlanRun(runId, deadlineMs = 120_000) {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    const run = await request(`/api/v1/drama/plan/runs/${runId}`);
    if (run.status === "completed" || run.status === "failed") {
      return run;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("规划 Run 轮询超时");
}

async function main() {
  const email = `drama-plan-rerun-${Date.now()}@example.com`;
  const reg = await request("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password: "testpass123" }),
  });
  globalThis.__DRAMA_PLAN_RERUN_TOKEN = reg.token;

  const sessionId = crypto.randomUUID();
  const session = await request("/api/v1/imageSession/ensure", {
    method: "POST",
    body: JSON.stringify({
      sessionId,
      mode: "chat",
      kind: "canvas",
      title: "短剧规划重跑测试",
    }),
  });
  const sid = session.sessionId ?? session.id ?? sessionId;

  const created = await request("/api/v1/drama/plan/runs", {
    method: "POST",
    body: JSON.stringify({
      sessionId: sid,
      userIdea:
        "都市爱情短剧：咖啡店老板与常客在雨夜重逢，三分钟讲完误会与和解",
      targetDurationSec: 90,
      aspectRatio: "9:16",
    }),
  });

  const finished = await pollPlanRun(created.id);
  if (finished.status !== "completed") {
    throw new Error(`初次规划失败: ${finished.error ?? finished.status}`);
  }

  const projectId = finished.projectId;
  const shotIdsBefore = finished.project.project.shots.map((s) => s.id);
  if (!shotIdsBefore.length) throw new Error("无分镜 id");

  const patchedTitle = `${finished.project.project.script.title}（修订）`;
  const rerun = await request(`/api/v1/drama/plan/runs/${created.id}/rerun`, {
    method: "POST",
    body: JSON.stringify({
      fromAgent: "storyboard",
      projectPatch: {
        script: {
          ...finished.project.project.script,
          title: patchedTitle,
        },
      },
    }),
  });

  if (rerun.status !== "planning") {
    throw new Error(`重跑未进入 planning: ${rerun.status}`);
  }

  const rerunFinished = await pollPlanRun(created.id);
  if (rerunFinished.status !== "completed") {
    throw new Error(`重跑失败: ${rerunFinished.error ?? rerunFinished.status}`);
  }

  if (rerunFinished.projectId !== projectId) {
    throw new Error("重跑应更新同一 project，而非新建");
  }

  const shotIdsAfter = rerunFinished.project.project.shots.map((s) => s.id);
  const upstreamIdsKept = shotIdsBefore.every((id) => shotIdsAfter.includes(id));
  if (!upstreamIdsKept) {
    throw new Error("上游分镜 id 未保留");
  }

  if (rerunFinished.project.project.script.title !== patchedTitle) {
    throw new Error("projectPatch 未生效");
  }

  const storyboardAgent = rerunFinished.agents?.storyboard;
  if (storyboardAgent?.status !== "done") {
    throw new Error(`分镜 Agent 未完成: ${storyboardAgent?.status}`);
  }

  console.log(
    `✓ 从分镜重跑成功：project ${projectId}，保留 ${shotIdsBefore.length} 个分镜 id`,
  );
}

main().catch((err) => {
  console.error("✗", err.message);
  process.exit(1);
});
