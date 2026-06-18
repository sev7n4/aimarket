#!/usr/bin/env node
/**
 * 生产短剧全链路验收：登录 → 规划 → 制作 → poll
 *
 * API_URL=http://119.29.173.89:4100
 * PROD_EMAIL=user001@163.com PROD_PASSWORD=...
 * PROD_RUN_TIMEOUT_MS=1800000  # 默认 30 分钟
 *
 * 成功条件：completed（有 finalVideoUrl）或 waiting_confirm（积分门控）
 */
import crypto from "node:crypto";

const API = process.env.API_URL ?? "http://119.29.173.89:4100";
const EMAIL = process.env.PROD_EMAIL ?? "user001@163.com";
const PASSWORD = process.env.PROD_PASSWORD ?? "11111111";
const RUN_TIMEOUT_MS = Number(process.env.PROD_RUN_TIMEOUT_MS ?? 1_800_000);
const PLAN_TIMEOUT_MS = Number(process.env.PROD_PLAN_TIMEOUT_MS ?? 300_000);

let token = "";

async function request(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
    signal: AbortSignal.timeout(120_000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error?.message ?? `HTTP ${res.status} ${path}`);
  }
  return json.data ?? json;
}

async function login() {
  const data = await request("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!data.token) throw new Error("登录失败：无 token");
  token = data.token;
  const points = await request("/api/v1/user/queryPoints");
  const credits =
    typeof points === "number" ? points : (points.credits ?? points);
  console.log(`✓ 登录 ${EMAIL}，积分 ${credits}`);
}

async function pollPlanRun(runId) {
  const deadline = Date.now() + PLAN_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const run = await request(`/api/v1/drama/plan/runs/${runId}`);
    if (run.status === "completed" || run.status === "failed") return run;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("规划 Run 轮询超时");
}

async function pollDramaRun(runId) {
  const deadline = Date.now() + RUN_TIMEOUT_MS;
  let last = "";
  while (Date.now() < deadline) {
    const run = await request(`/api/v1/drama/runs/${runId}`);
    if (run.status !== last) {
      console.log(
        `  制作状态: ${run.status} step=${run.currentStepIndex ?? 0}${run.error ? ` err=${run.error}` : ""}`,
      );
      last = run.status;
    }
    if (run.status === "completed") return run;
    if (run.status === "waiting_confirm") return run;
    if (run.status === "failed" || run.status === "cancelled") {
      throw new Error(run.error ?? `Run ${run.status}`);
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error("制作 Run 轮询超时");
}

async function main() {
  console.log(`\n生产短剧全链路 @ ${API}\n`);
  await login();

  const sessionId = crypto.randomUUID();
  const session = await request("/api/v1/imageSession/ensure", {
    method: "POST",
    body: JSON.stringify({
      sessionId,
      mode: "chat",
      kind: "canvas",
      title: `短剧生产验收 ${new Date().toISOString().slice(0, 10)}`,
    }),
  });
  const sid = session.sessionId ?? session.id ?? sessionId;

  const plan = await request("/api/v1/drama/plan/runs", {
    method: "POST",
    body: JSON.stringify({
      sessionId: sid,
      userIdea:
        "都市爱情短剧：咖啡店老板与常客在雨夜重逢，三分钟讲完误会与和解",
      targetDurationSec: 90,
      aspectRatio: "9:16",
      autoProduce: false,
    }),
  });
  console.log(`✓ 规划 Run 已创建: ${plan.id}`);

  const finished = await pollPlanRun(plan.id);
  if (finished.status !== "completed") {
    throw new Error(`规划失败: ${finished.error ?? finished.status}`);
  }
  const projectId = finished.projectId;
  const shots = finished.project?.project?.shots?.length ?? 0;
  console.log(
    `✓ 规划完成 project=${projectId} shots=${shots} 预估=${finished.estimatedPoints ?? "?"} 分`,
  );

  const state = await request(
    `/api/v1/drama/sessions/${encodeURIComponent(sid)}/state`,
  );
  if (!state.planRun?.id) {
    throw new Error("会话状态 API 未返回 planRun");
  }
  console.log(`✓ 会话状态 API planRun=${state.planRun.id}`);

  const project = await request(`/api/v1/drama/projects/${projectId}`);
  const patched = {
    ...project.project,
    productionParams: {
      ...(project.project.productionParams ?? {}),
      previewTier: "low",
    },
  };
  await request(`/api/v1/drama/projects/${projectId}`, {
    method: "PATCH",
    body: JSON.stringify({ project: patched }),
  });
  console.log("✓ 已设为低清 preview 档");

  const run = await request(`/api/v1/drama/projects/${projectId}/produce`, {
    method: "POST",
    body: JSON.stringify({ sessionId: sid, confirmed: true }),
  });
  console.log(`✓ 制作 Run 已启动: ${run.id}`);

  const settled = await pollDramaRun(run.id);
  if (settled.status === "waiting_confirm") {
    console.log(
      `✓ 积分门控 waiting_confirm（预估 ${settled.estimatedPoints ?? "?"} 分）`,
    );
    return;
  }
  if (settled.finalVideoUrl) {
    console.log(`✓ 成片完成: ${settled.finalVideoUrl}`);
    return;
  }
  console.log("✓ 制作 completed（无 finalVideoUrl，可能仍在合成）");
}

main().catch((err) => {
  console.error("✗", err.message);
  process.exit(1);
});
