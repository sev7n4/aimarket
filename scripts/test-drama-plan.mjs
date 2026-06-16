#!/usr/bin/env node
import crypto from "node:crypto";
/**
 * AI 短剧规划流集成测试（mock / rule-based fallback）
 * API_URL=http://localhost:4000 pnpm exec tsx scripts/test-drama-plan.mjs
 */
const API = process.env.API_URL ?? "http://localhost:4000";

async function request(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(globalThis.__DRAMA_PLAN_TEST_TOKEN
        ? { Authorization: `Bearer ${globalThis.__DRAMA_PLAN_TEST_TOKEN}` }
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
  const email = `drama-plan-${Date.now()}@example.com`;
  const reg = await request("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password: "testpass123" }),
  });
  globalThis.__DRAMA_PLAN_TEST_TOKEN = reg.token;

  const sessionId = crypto.randomUUID();
  const session = await request("/api/v1/imageSession/ensure", {
    method: "POST",
    body: JSON.stringify({
      sessionId,
      mode: "chat",
      kind: "canvas",
      title: "短剧规划流测试",
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

  if (!created.id) throw new Error("创建规划 Run 失败");
  console.log(`✓ 规划 Run 已创建: ${created.id}`);

  const finished = await pollPlanRun(created.id);
  if (finished.status !== "completed") {
    throw new Error(`规划失败: ${finished.error ?? finished.status}`);
  }

  const agents = finished.agents ?? {};
  for (const key of ["writer", "director", "character", "cinematographer", "storyboard"]) {
    if (agents[key]?.status !== "done") {
      throw new Error(`Agent ${key} 未完成: ${agents[key]?.status}`);
    }
  }
  console.log("✓ 五 Agent 均完成");

  if (!finished.projectId || !finished.project?.project?.shots?.length) {
    throw new Error("规划完成但无项目/分镜");
  }

  const shots = finished.project.project.shots;
  if (shots.length < 8 || shots.length > 15) {
    throw new Error(`分镜数异常: ${shots.length}`);
  }
  if (!finished.project.project.characters?.length) {
    throw new Error("无角色");
  }
  if (!finished.project.project.script?.acts?.length) {
    throw new Error("无 acts");
  }

  console.log(
    `✓ 规划完成：project ${finished.projectId}，${shots.length} 镜，预估 ${finished.estimatedPoints ?? "?"} 分`,
  );
}

main().catch((err) => {
  console.error("✗", err.message);
  process.exit(1);
});
