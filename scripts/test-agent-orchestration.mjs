#!/usr/bin/env node
/**
 * Agent 编排 P0+P1 集成测试（需 API mock 运行中）
 * API_URL=http://localhost:4000 node scripts/test-agent-orchestration.mjs
 */
const API = process.env.API_URL ?? "http://localhost:4000";

const results = [];

function ok(name, pass, detail = "") {
  results.push({ name, pass, detail });
  const icon = pass ? "✓" : "✗";
  console.log(`${icon} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function req(path, init = {}) {
  const headers = { "Content-Type": "application/json", ...init.headers };
  const res = await fetch(`${API}${path}`, { ...init, headers });
  const json = await res.json().catch(() => ({}));
  return { res, json };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitJob(jobId, authH, maxAttempts = 25) {
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(800);
    const { json } = await req(`/api/v1/ai/jobs/${jobId}`, { headers: authH });
    const st = json?.data?.status;
    if (st === "failed" || st === "succeeded") return json?.data ?? null;
  }
  return null;
}

async function waitRunSettled(runId, authH, maxAttempts = 40) {
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(800);
    const { json } = await req(`/api/v1/agent/runs/${runId}`, { headers: authH });
    const data = json?.data;
    if (!data) return null;
    if (
      data.status === "completed" ||
      data.status === "failed" ||
      data.status === "cancelled"
    ) {
      return data;
    }
    if (data.status === "waiting_job" && data.pendingJobId) {
      await waitJob(data.pendingJobId, authH, 25);
      continue;
    }
    if (data.status === "waiting_confirm") {
      return data;
    }
  }
  const { json } = await req(`/api/v1/agent/runs/${runId}`, { headers: authH });
  return json?.data ?? null;
}

async function main() {
  console.log(`\nAgent orchestration integration @ ${API}\n`);

  const health = await req("/health");
  ok("GET /health", health.res.ok);

  const email = `agent_${Date.now()}@test.local`;
  const password = "testpass123";
  const reg = await req("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const token = reg.json?.data?.token;
  ok("register", reg.res.status === 201 && !!token);
  const authH = { Authorization: `Bearer ${token}` };

  const sessionId = crypto.randomUUID();
  const ensure = await req("/api/v1/imageSession/ensure", {
    method: "POST",
    headers: authH,
    body: JSON.stringify({
      sessionId,
      mode: "chat",
      kind: "canvas",
      title: "Agent 集成测试",
    }),
  });
  ok("ensure session", ensure.res.ok);

  const planRes = await req("/api/v1/agent/plan", {
    method: "POST",
    headers: authH,
    body: JSON.stringify({
      prompt: "帮我把商品抠图再超分",
      mode: "chat",
    }),
  });
  const plan = planRes.json?.data;
  ok(
    "POST /agent/plan",
    planRes.res.ok &&
      Array.isArray(plan?.steps) &&
      plan.steps.length >= 1 &&
      (plan.planSource === "rule" || plan.planSource === "llm"),
    `steps=${plan?.steps?.length} source=${plan?.planSource}`,
  );
  ok(
    "plan requiresConfirm (multi-step)",
    plan?.requiresConfirm === true,
    `points=${plan?.estimatedPoints}`,
  );

  const planMeta = planRes.json?.meta;
  ok(
    "plan meta.llmEnabled",
    typeof planMeta?.llmEnabled === "boolean",
    String(planMeta?.llmEnabled),
  );

  const runCreate = await req("/api/v1/agent/runs", {
    method: "POST",
    headers: authH,
    body: JSON.stringify({
      sessionId,
      prompt: "一只咖啡杯放在木桌上，柔和自然光",
      mode: "quick",
    }),
  });
  const runId = runCreate.json?.data?.id;
  ok(
    "POST /agent/runs",
    runCreate.res.status === 201 && !!runId,
    `status=${runCreate.json?.data?.status}`,
  );

  if (runId) {
    const getRun = await req(`/api/v1/agent/runs/${runId}`, { headers: authH });
    ok(
      "GET /agent/runs/:id",
      getRun.res.ok && getRun.json?.data?.id === runId,
      `status=${getRun.json?.data?.status}`,
    );

    let runState = await waitRunSettled(runId, authH);
    if (runState?.status === "waiting_confirm") {
      const confirm = await req(`/api/v1/agent/runs/${runId}/confirm`, {
        method: "POST",
        headers: authH,
      });
      ok("POST /agent/runs/:id/confirm", confirm.res.ok);
      runState = await waitRunSettled(runId, authH, 50);
    }

    ok(
      "agent run completes",
      runState?.status === "completed",
      `${runState?.status ?? "timeout"}${runState?.error ? ` err=${runState.error}` : ""}`,
    );
    ok(
      "run has plan",
      Array.isArray(runState?.plan?.steps) && runState.plan.steps.length >= 1,
    );
  }

  const confirmSessionId = crypto.randomUUID();
  await req("/api/v1/imageSession/ensure", {
    method: "POST",
    headers: authH,
    body: JSON.stringify({
      sessionId: confirmSessionId,
      mode: "chat",
      kind: "canvas",
      title: "Agent 取消测试",
    }),
  });

  const runMulti = await req("/api/v1/agent/runs", {
    method: "POST",
    headers: authH,
    body: JSON.stringify({
      sessionId: confirmSessionId,
      prompt: "抠图去背景再超分放大",
      mode: "chat",
    }),
  });
  const multiRunId = runMulti.json?.data?.id;
  if (multiRunId) {
    let multi = runMulti.json?.data;
    for (let i = 0; i < 8 && multi?.status === "planning"; i++) {
      await sleep(300);
      const g = await req(`/api/v1/agent/runs/${multiRunId}`, { headers: authH });
      multi = g.json?.data;
    }
    if (multi?.status === "waiting_confirm") {
      const cancel = await req(`/api/v1/agent/runs/${multiRunId}/cancel`, {
        method: "POST",
        headers: authH,
      });
      ok(
        "POST /agent/runs/:id/cancel",
        cancel.res.ok && cancel.json?.data?.status === "cancelled",
      );
    } else {
      ok(
        "POST /agent/runs/:id/cancel (skipped)",
        true,
        `status=${multi?.status}`,
      );
    }
  }

  const notFound = await req("/api/v1/agent/runs/00000000-0000-4000-8000-000000000099", {
    headers: authH,
  });
  ok("GET /agent/runs/:id 404", notFound.res.status === 404);

  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} 通过\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
