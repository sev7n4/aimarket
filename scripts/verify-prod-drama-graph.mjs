#!/usr/bin/env node
/**
 * 生产环境短剧 DAG graph API 冒烟
 * API_URL=http://119.29.173.89:4100 node scripts/verify-prod-drama-graph.mjs
 *
 * 使用 plan autoProduce 创建制作 Run，经 sessions state 取 dramaRun.id。
 */
import crypto from "node:crypto";

const API = process.env.API_URL ?? "http://119.29.173.89:4100";

function formatApiError(json, status) {
  const err = json?.error;
  if (typeof err?.message === "string" && err.message) {
    return `${err.message} (HTTP ${status})`;
  }
  if (Array.isArray(err)) {
    return `${JSON.stringify(err)} (HTTP ${status})`;
  }
  return `${JSON.stringify(err ?? json)} (HTTP ${status})`;
}

async function request(path, init = {}, label = path) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(globalThis.__GRAPH_TOKEN
        ? { Authorization: `Bearer ${globalThis.__GRAPH_TOKEN}` }
        : {}),
      ...init.headers,
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${label}: ${formatApiError(json, res.status)}`);
  }
  return json.data ?? json;
}

async function requestWithRetry(path, init = {}, label = path, attempts = 10) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await request(path, init, label);
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const rateLimited =
        msg.includes("429") ||
        msg.includes("过于频繁") ||
        msg.includes("RATE_LIMIT");
      if (!rateLimited) throw err;
      const waitMs = Math.min(20_000, 4000 * (i + 1));
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw lastErr;
}

async function pollPlanRun(runId, deadlineMs = 180_000) {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    const run = await request(`/api/v1/drama/plan/runs/${runId}`, {}, "poll plan");
    if (run.status === "completed" || run.status === "failed") return run;
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("规划超时");
}

async function resolveDramaRunId(sessionId) {
  const state = await request(
    `/api/v1/drama/sessions/${sessionId}/state`,
    {},
    "session state",
  );
  const runId = state.dramaRun?.id;
  if (runId) return runId;
  throw new Error("autoProduce 未创建 dramaRun（请确认已购买足够积分）");
}

async function main() {
  const email = `prod-graph-${Date.now()}@test.local`;
  const reg = await requestWithRetry(
    "/api/v1/auth/register",
    {
      method: "POST",
      body: JSON.stringify({ email, password: "testpass123" }),
    },
    "register",
  );
  globalThis.__GRAPH_TOKEN = reg.token;

  const packages = await request("/api/v1/product/packages", {}, "packages");
  const largest = [...(packages ?? [])].sort(
    (a, b) => (b.credits ?? 0) - (a.credits ?? 0),
  )[0];
  if (largest?.id) {
    await request(
      "/api/v1/product/purchase",
      {
        method: "POST",
        body: JSON.stringify({ packageId: largest.id }),
      },
      "purchase credits",
    );
  }

  const ensured = await request(
    "/api/v1/imageSession/ensure",
    {
      method: "POST",
      body: JSON.stringify({
        sessionId: crypto.randomUUID(),
        mode: "chat",
        kind: "canvas",
        title: "prod-graph-smoke",
      }),
    },
    "ensure session",
  );
  const sessionId = ensured.id;
  if (!sessionId) throw new Error("ensure session 未返回 id");

  const plan = await request(
    "/api/v1/drama/plan/runs",
    {
      method: "POST",
      body: JSON.stringify({
        sessionId,
        userIdea: "都市爱情：雨夜咖啡店的重逢，三分钟讲完误会与和解",
        targetDurationSec: 90,
        aspectRatio: "9:16",
        autoProduce: true,
      }),
    },
    "start plan",
  );

  const finished = await pollPlanRun(plan.id);
  if (finished.status !== "completed") {
    throw new Error(finished.error ?? "规划失败");
  }
  if (!finished.projectId) throw new Error("无 projectId");

  const runId = await resolveDramaRunId(sessionId);

  const graph = await request(
    `/api/v1/drama/runs/${runId}/graph`,
    {},
    "get graph",
  );
  if (!graph.nodes?.length) throw new Error("graph.nodes 为空");
  if (!graph.edges?.length) throw new Error("graph.edges 为空");
  if (graph.skillId !== "drama-short-v1") {
    throw new Error(`意外 skillId: ${graph.skillId}`);
  }
  const concat = graph.nodes.find((n) => n.id === "concat");
  if (!concat) throw new Error("缺少 concat 节点");

  console.log(
    `✓ 生产 DAG：run=${runId} nodes=${graph.nodes.length} concat=${concat.status}`,
  );
}

main().catch((err) => {
  console.error("✗", err.message);
  process.exit(1);
});
