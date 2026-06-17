#!/usr/bin/env node
import crypto from "node:crypto";
/**
 * AI 短剧会话状态恢复 API 测试
 * API_URL=http://localhost:4000 pnpm exec tsx scripts/test-drama-session-recover.mjs
 */
const API = process.env.API_URL ?? "http://localhost:4000";

async function request(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(globalThis.__DRAMA_SESSION_RECOVER_TOKEN
        ? { Authorization: `Bearer ${globalThis.__DRAMA_SESSION_RECOVER_TOKEN}` }
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
  const email = `drama-session-recover-${Date.now()}@example.com`;
  const reg = await request("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password: "testpass123" }),
  });
  globalThis.__DRAMA_SESSION_RECOVER_TOKEN = reg.token;

  const sessionId = crypto.randomUUID();
  const session = await request("/api/v1/imageSession/ensure", {
    method: "POST",
    body: JSON.stringify({
      sessionId,
      mode: "chat",
      kind: "canvas",
      title: "短剧会话恢复测试",
    }),
  });
  const sid = session.sessionId ?? session.id ?? sessionId;

  const emptyState = await request(
    `/api/v1/drama/sessions/${encodeURIComponent(sid)}/state`,
  );
  if (emptyState.planRun || emptyState.dramaRun || emptyState.draftProject) {
    throw new Error("空会话不应有短剧状态");
  }

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
    throw new Error(`规划失败: ${finished.error ?? finished.status}`);
  }

  const afterPlan = await request(
    `/api/v1/drama/sessions/${encodeURIComponent(sid)}/state`,
  );
  if (!afterPlan.planRun || afterPlan.planRun.id !== created.id) {
    throw new Error("规划完成后应返回 planRun");
  }
  if (!afterPlan.draftProject?.id) {
    throw new Error("规划完成后应返回 draftProject");
  }
  if (afterPlan.dramaRun) {
    throw new Error("仅规划时不应返回 dramaRun");
  }

  console.log(
    `✓ 会话恢复 API：planRun=${afterPlan.planRun.id} draft=${afterPlan.draftProject.id}`,
  );
}

main().catch((err) => {
  console.error("✗", err.message);
  process.exit(1);
});
