#!/usr/bin/env node
/**
 * 生产环境短剧 DAG graph API 冒烟
 * API_URL=http://119.29.173.89:4100 node scripts/verify-prod-drama-graph.mjs
 */
import crypto from "node:crypto";

const API = process.env.API_URL ?? "http://119.29.173.89:4100";

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
    throw new Error(
      `${label}: ${json?.error?.message ?? JSON.stringify(json?.error ?? json)} (HTTP ${res.status})`,
    );
  }
  return json.data ?? json;
}

function normalizeShot(shot) {
  return {
    ...shot,
    useLastFrameContinuity:
      shot.useLastFrameContinuity === true ||
      shot.useLastFrameContinuity === "true",
  };
}

function normalizeProject(project) {
  return {
    ...project,
    shots: (project.shots ?? []).map(normalizeShot),
  };
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

async function main() {
  const email = `prod-graph-${Date.now()}@test.local`;
  const reg = await request(
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

  const sessionId = crypto.randomUUID();
  await request(
    "/api/v1/imageSession/ensure",
    {
      method: "POST",
      body: JSON.stringify({
        sessionId,
        mode: "chat",
        kind: "canvas",
        title: "prod-graph-smoke",
      }),
    },
    "ensure session",
  );

  const plan = await request(
    "/api/v1/drama/plan/runs",
    {
      method: "POST",
      body: JSON.stringify({
        sessionId,
        userIdea: "都市爱情：雨夜咖啡店的重逢，三分钟讲完误会与和解",
        targetDurationSec: 90,
        aspectRatio: "9:16",
      }),
    },
    "start plan",
  );

  const finished = await pollPlanRun(plan.id);
  if (finished.status !== "completed") {
    throw new Error(finished.error ?? "规划失败");
  }
  const projectId = finished.projectId;
  if (!projectId) throw new Error("无 projectId");

  const project = await request(
    `/api/v1/drama/projects/${projectId}`,
    {},
    "get project",
  );
  const normalized = normalizeProject(project.project);
  const chars = normalized.characters.map((c) => ({
    ...c,
    turnaroundStatus: "locked",
    refOutputIds: c.refOutputIds ?? {
      front: crypto.randomUUID(),
      three_quarter: crypto.randomUUID(),
      side: crypto.randomUUID(),
    },
  }));
  await request(
    `/api/v1/drama/projects/${projectId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        project: {
          ...normalized,
          characters: chars,
          productionParams: {
            ...normalized.productionParams,
            previewTier: "low",
          },
        },
      }),
    },
    "PATCH project",
  );

  const run = await request(
    `/api/v1/drama/projects/${projectId}/produce`,
    {
      method: "POST",
      body: JSON.stringify({ sessionId, confirmed: true }),
    },
    "produce",
  );
  const runId = run.id;
  if (!runId) throw new Error("创建制作 Run 失败");

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
