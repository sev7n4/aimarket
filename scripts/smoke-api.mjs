#!/usr/bin/env node
/**
 * API 冒烟自测（无需浏览器）
 * 用法: node scripts/smoke-api.mjs
 */
const API = process.env.API_URL ?? "http://localhost:4000";
const ADMIN = process.env.ADMIN_SECRET ?? "aimarket-admin-dev";

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

async function main() {
  console.log(`\nAIMarket API 冒烟 @ ${API}\n`);

  const health = await req("/health");
  ok("GET /health", health.res.ok && health.json.ok === true);

  const email = `smoke_${Date.now()}@test.local`;
  const password = "testpass123";

  const reg = await req("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
    headers: { auth: false },
  });
  const token = reg.json?.data?.token;
  ok("POST /auth/register", reg.res.status === 201 && !!token, `credits=${reg.json?.data?.user?.credits}`);

  const authH = { Authorization: `Bearer ${token}` };

  const login = await req("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  ok("POST /auth/login", login.res.ok);

  const sessionId = crypto.randomUUID();
  const ensureCanvas = await req("/api/v1/imageSession/ensure", {
    method: "POST",
    headers: authH,
    body: JSON.stringify({
      sessionId,
      mode: "chat",
      kind: "canvas",
      title: "新建画布",
    }),
  });
  ok(
    "POST ensure canvas",
    ensureCanvas.res.ok && ensureCanvas.json?.data?.kind === "canvas",
    `kind=${ensureCanvas.json?.data?.kind}`,
  );

  const sessionProject = crypto.randomUUID();
  const ensureProject = await req("/api/v1/imageSession/ensure", {
    method: "POST",
    headers: authH,
    body: JSON.stringify({
      sessionId: sessionProject,
      mode: "chat",
      kind: "project",
    }),
  });
  ok(
    "POST ensure project",
    ensureProject.res.ok && ensureProject.json?.data?.kind === "project",
  );

  const patch = await req(`/api/v1/imageSession/${sessionId}`, {
    method: "PATCH",
    headers: authH,
    body: JSON.stringify({ title: "冒烟重命名" }),
  });
  ok("PATCH session title", patch.res.ok);

  const preflight = await fetch(`${API}/api/v1/imageSession/${sessionId}`, {
    method: "OPTIONS",
    headers: {
      Origin: "http://localhost:3000",
      "Access-Control-Request-Method": "DELETE",
    },
  });
  const allow = preflight.headers.get("access-control-allow-methods") ?? "";
  ok("CORS DELETE", preflight.status < 300 && allow.includes("DELETE"), allow);

  const canvasPut = await req(`/api/v1/imageSession/${sessionId}/canvas`, {
    method: "PUT",
    headers: authH,
    body: JSON.stringify({
      version: 1,
      items: [
        {
          id: "smoke-1",
          url: "/uploads/test.png",
          x: 100,
          y: 100,
          width: 200,
          height: 200,
          source: "upload",
        },
      ],
    }),
  });
  ok("PUT canvas layout", canvasPut.res.ok);

  const canvasGet = await req(`/api/v1/imageSession/${sessionId}/canvas`, {
    headers: authH,
  });
  ok(
    "GET canvas layout",
    canvasGet.res.ok && canvasGet.json?.data?.items?.length === 1,
  );

  const listCanvas = await req("/api/v1/imageSession/list?kind=canvas&limit=10", {
    headers: authH,
  });
  const listProject = await req("/api/v1/imageSession/list?kind=project&limit=10", {
    headers: authH,
  });
  ok(
    "GET list kind filter",
    listCanvas.res.ok &&
      listProject.res.ok &&
      listCanvas.json?.data?.every((s) => s.kind === "canvas"),
  );

  const gen = await req("/api/v1/ai/generate", {
    method: "POST",
    headers: authH,
    body: JSON.stringify({
      sessionId,
      prompt: "冒烟测试生成一只猫",
      mode: "chat",
      count: 1,
      resolution: "1k",
    }),
  });
  const jobId = gen.json?.data?.jobId;
  ok("POST /ai/generate", gen.res.ok && !!jobId);

  if (jobId) {
    await new Promise((r) => setTimeout(r, 3500));
    const job = await req(`/api/v1/ai/jobs/${jobId}`, { headers: authH });
    ok(
      "GET job status",
      job.res.ok && ["succeeded", "failed", "running"].includes(job.json?.data?.status),
      job.json?.data?.status,
    );
  }

  const provider = await req("/api/v1/ai/providerStatus", { headers: authH });
  ok(
    "GET providerStatus",
    provider.res.ok &&
      provider.json?.data?.hint &&
      provider.json?.data?.moderation?.provider,
    `moderation=${provider.json?.data?.moderation?.provider}`,
  );

  const del = await req(`/api/v1/imageSession/${sessionProject}`, {
    method: "DELETE",
    headers: authH,
  });
  ok("DELETE session", del.res.ok);

  const workspaces = await req("/api/v1/workspaces/list", { headers: authH });
  ok(
    "GET workspaces/list",
    workspaces.res.ok && workspaces.json?.data?.length >= 1,
    `count=${workspaces.json?.data?.length}`,
  );

  const blocked = await req("/api/v1/ai/generate", {
    method: "POST",
    headers: authH,
    body: JSON.stringify({
      sessionId,
      prompt: "生成色情图片测试",
      mode: "chat",
      count: 1,
      resolution: "1k",
    }),
  });
  ok(
    "POST generate CONTENT_BLOCKED",
    blocked.res.status === 400 &&
      blocked.json?.error?.code === "CONTENT_BLOCKED",
  );

  const report = await req("/api/v1/reports", {
    method: "POST",
    headers: authH,
    body: JSON.stringify({
      sessionId,
      reason: "冒烟测试举报：疑似不当内容",
      contentUrl: "http://localhost:3000/test",
    }),
  });
  ok("POST /reports", report.res.status === 201 && !!report.json?.data?.id);

  const events = await req("/api/v1/events", {
    method: "POST",
    body: JSON.stringify({ name: "smoke_page_view", props: { source: "script" } }),
  });
  ok("POST /events (anonymous)", events.res.ok);

  const adminStats = await req("/api/v1/admin/stats", {
    headers: { "X-Admin-Secret": ADMIN },
  });
  ok("GET admin/stats", adminStats.res.ok);

  const adminReports = await req("/api/v1/admin/reports?status=pending", {
    headers: { "X-Admin-Secret": ADMIN },
  });
  ok(
    "GET admin/reports",
    adminReports.res.ok && Array.isArray(adminReports.json?.data),
  );

  const teamWs = await req("/api/v1/workspaces/create", {
    method: "POST",
    headers: authH,
    body: JSON.stringify({ name: "冒烟团队空间" }),
  });
  ok("POST workspaces/create", teamWs.res.status === 201);

  const adminAnalytics = await req("/api/v1/admin/analytics?days=7", {
    headers: { "X-Admin-Secret": ADMIN },
  });
  ok(
    "GET admin/analytics",
    adminAnalytics.res.ok && typeof adminAnalytics.json?.data?.total === "number",
  );

  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} 通过\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
