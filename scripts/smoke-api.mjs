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

async function waitJob(jobId, authH, maxAttempts = 15) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 800));
    const { json } = await req(`/api/v1/ai/jobs/${jobId}`, { headers: authH });
    const st = json?.data?.status;
    if (st === "failed" || st === "succeeded") return json?.data ?? null;
  }
  return null;
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
    const taskStatus = await req(
      `/api/v1/imageTask/taskStatus?taskId=${jobId}`,
      { headers: authH },
    );
    ok(
      "GET imageTask/taskStatus",
      taskStatus.res.ok && taskStatus.json?.data?.taskId === jobId,
      `status=${taskStatus.json?.data?.status}`,
    );

    await new Promise((r) => setTimeout(r, 3500));
    const job = await req(`/api/v1/ai/jobs/${jobId}`, { headers: authH });
    ok(
      "GET job status",
      job.res.ok && ["succeeded", "failed", "running"].includes(job.json?.data?.status),
      job.json?.data?.status,
    );
  }

  const toolsList = await req("/api/v1/tools/list", { headers: authH });
  const toolRows = toolsList.json?.data ?? [];
  ok(
    "GET tools/list",
    toolsList.res.ok &&
      toolRows.some((t) => t.id === "cutout") &&
      toolRows.find((t) => t.id === "crop")?.clientOnly === true,
    `count=${toolRows.length}`,
  );

  const cropRun = await req("/api/v1/tools/crop/run", {
    method: "POST",
    headers: authH,
    body: JSON.stringify({ sessionId }),
  });
  ok(
    "POST tools/crop CLIENT_ONLY",
    cropRun.res.status === 400 &&
      cropRun.json?.error?.code === "CLIENT_ONLY_TOOL",
  );

  const expandNoRef = await req("/api/v1/tools/expand/run", {
    method: "POST",
    headers: authH,
    body: JSON.stringify({ sessionId }),
  });
  ok(
    "POST tools/expand SOURCE_REQUIRED",
    expandNoRef.res.status === 400 &&
      expandNoRef.json?.error?.code === "SOURCE_REQUIRED",
  );

  if (jobId) {
    let outputId = null;
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 800));
      const msgs = await req(`/api/v1/imageSession/${sessionId}/messages`, {
        headers: authH,
      });
      const outs =
        msgs.json?.data?.flatMap((m) => m.outputs ?? []) ?? [];
      if (outs[0]?.id) {
        outputId = outs[0].id;
        break;
      }
    }
    if (outputId) {
      const expandRun = await req("/api/v1/tools/expand/run", {
        method: "POST",
        headers: authH,
        body: JSON.stringify({
          sessionId,
          referenceOutputIds: [outputId],
        }),
      });
      const expandJobId = expandRun.json?.data?.jobId;
      ok(
        "POST tools/expand with ref",
        expandRun.res.ok && !!expandJobId,
        `job=${expandJobId}`,
      );
      if (expandJobId) {
        const expandJob = await waitJob(expandJobId, authH);
        ok(
          "expand job succeeded",
          expandJob?.status === "succeeded" && !!expandJob?.outputs?.[0]?.url,
          expandJob?.outputs?.[0]?.url ?? expandJob?.status ?? "no url",
        );
      }

      const inpaintRun = await req("/api/v1/tools/inpaint/run", {
        method: "POST",
        headers: authH,
        body: JSON.stringify({
          sessionId,
          referenceOutputIds: [outputId],
        }),
      });
      const inpaintJobId = inpaintRun.json?.data?.jobId;
      ok(
        "POST tools/inpaint with ref",
        inpaintRun.res.ok && !!inpaintJobId,
        `job=${inpaintJobId}`,
      );
      if (inpaintJobId) {
        const inpaintJob = await waitJob(inpaintJobId, authH);
        ok(
          "inpaint job succeeded",
          inpaintJob?.status === "succeeded" && !!inpaintJob?.outputs?.[0]?.url,
          inpaintJob?.outputs?.[0]?.url ?? inpaintJob?.status ?? "no url",
        );
      }

      const cutoutRun = await req("/api/v1/tools/cutout/run", {
        method: "POST",
        headers: authH,
        body: JSON.stringify({
          sessionId,
          referenceOutputIds: [outputId],
        }),
      });
      const cutoutJobId = cutoutRun.json?.data?.jobId;
      ok(
        "POST tools/cutout with ref",
        cutoutRun.res.ok && !!cutoutJobId,
        `job=${cutoutJobId}`,
      );

      if (cutoutJobId) {
        const cutoutJob = await waitJob(cutoutJobId, authH);
        const cutoutUrl = cutoutJob?.outputs?.[0]?.url ?? null;
        ok(
          "cutout job PNG output",
          cutoutJob?.status === "succeeded" &&
            !!cutoutUrl &&
            /\.png($|\?)/i.test(cutoutUrl),
          cutoutUrl ?? cutoutJob?.status ?? "no url",
        );
      }

      const upscaleRun = await req("/api/v1/tools/upscale/run", {
        method: "POST",
        headers: authH,
        body: JSON.stringify({
          sessionId,
          referenceOutputIds: [outputId],
          scale: "2x",
          resolution: "2k",
        }),
      });
      const upscaleJobId = upscaleRun.json?.data?.jobId;
      ok(
        "POST tools/upscale 2x",
        upscaleRun.res.ok && !!upscaleJobId,
        `job=${upscaleJobId}`,
      );
      if (upscaleJobId) {
        const upscaleJob = await waitJob(upscaleJobId, authH);
        ok(
          "upscale job 2x succeeded",
          upscaleJob?.status === "succeeded" && !!upscaleJob?.outputs?.[0]?.url,
          upscaleJob?.outputs?.[0]?.url ?? upscaleJob?.status ?? "no url",
        );
      }
    } else {
      ok("POST tools/expand with ref", false, "no message output id");
      ok("POST tools/cutout with ref", false, "no message output id");
    }
  }

  const provider = await req("/api/v1/ai/providerStatus", { headers: authH });
  ok(
    "GET providerStatus",
    provider.res.ok &&
      provider.json?.data?.hint &&
      provider.json?.data?.moderation?.provider &&
      provider.json?.data?.tools?.cutoutProvider === "tool-cutout-mock" &&
      provider.json?.data?.tools?.upscaleProvider === "tool-upscale-mock" &&
      provider.json?.data?.tools?.enhanceProvider === "tool-upscale-mock" &&
      provider.json?.data?.tools?.expandProvider === "tool-edit-mock" &&
      provider.json?.data?.tools?.inpaintProvider === "tool-edit-mock" &&
      provider.json?.data?.tools?.genericToolProvider === "tool-mock" &&
      (provider.json?.data?.promptOptimize?.activeProvider ===
        "template-mock" ||
        provider.json?.data?.promptOptimize?.activeProvider === "openai"),
    `promptOpt=${provider.json?.data?.promptOptimize?.activeProvider}`,
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
  const teamId = teamWs.json?.data?.id;

  if (teamId) {
    const invite = await req(`/api/v1/workspaces/${teamId}/invites`, {
      method: "POST",
      headers: authH,
      body: JSON.stringify({ role: "member", expiresInDays: 7 }),
    });
    const inviteCode = invite.json?.data?.code;
    ok("POST workspaces/invites", invite.res.status === 201 && !!inviteCode);

    const email2 = `smoke2_${Date.now()}@test.local`;
    const reg2 = await req("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: email2, password }),
    });
    const token2 = reg2.json?.data?.token;
    if (inviteCode && token2) {
      const join = await req("/api/v1/workspaces/join", {
        method: "POST",
        headers: { Authorization: `Bearer ${token2}` },
        body: JSON.stringify({ code: inviteCode }),
      });
      ok(
        "POST workspaces/join",
        join.res.ok && join.json?.data?.workspaceId === teamId,
      );
      const members = await req(`/api/v1/workspaces/${teamId}/members`, {
        headers: authH,
      });
      ok(
        "GET workspaces/members",
        members.res.ok && members.json?.data?.length >= 2,
        `count=${members.json?.data?.length}`,
      );
    }
  }

  const optimize = await req("/api/v1/prompt/optimize", {
    method: "POST",
    headers: authH,
    body: JSON.stringify({
      prompt: "产品白底图",
      mode: "chat",
    }),
  });
  ok(
    "POST prompt/optimize",
    optimize.res.ok &&
      optimize.json?.data?.prompt?.includes("产品白底图") &&
      (optimize.json?.data?.source === "template-mock" ||
        optimize.json?.data?.source === "openai"),
    `source=${optimize.json?.data?.source}`,
  );

  const uploadUrl = await req("/api/v1/assets/upload-url", {
    method: "POST",
    headers: authH,
    body: JSON.stringify({
      fileName: "test.png",
      mimeType: "image/png",
      sizeBytes: 1024,
      sessionId,
    }),
  });
  ok(
    "POST assets/upload-url",
    uploadUrl.res.ok && !!uploadUrl.json?.data?.assetId,
    `method=${uploadUrl.json?.data?.method}`,
  );

  const assetId = uploadUrl.json?.data?.assetId;
  if (assetId && uploadUrl.json?.data?.method === "POST") {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const form = new FormData();
    form.append("assetId", assetId);
    form.append("file", new Blob([png], { type: "image/png" }), "test.png");
    const complete = await fetch(`${API}/api/v1/assets/upload/complete`, {
      method: "POST",
      headers: { Authorization: authH.Authorization },
      body: form,
    });
    const completeJson = await complete.json().catch(() => ({}));
    ok(
      "POST assets/upload/complete",
      complete.ok && completeJson?.data?.url,
      completeJson?.data?.url,
    );
  }

  const promptReverse = await req("/api/v1/image/prompt-reverse", {
    method: "POST",
    headers: authH,
    body: JSON.stringify({
      imageUrl: "https://example.com/sample-product.jpg",
    }),
  });
  ok(
    "POST image/prompt-reverse",
    promptReverse.res.ok &&
      typeof promptReverse.json?.data?.prompt === "string",
    `source=${promptReverse.json?.data?.source}`,
  );

  if (assetId) {
    const reverseAsset = await req("/api/v1/image/prompt-reverse", {
      method: "POST",
      headers: authH,
      body: JSON.stringify({ assetId }),
    });
    ok(
      "POST image/prompt-reverse (assetId)",
      reverseAsset.res.ok && !!reverseAsset.json?.data?.prompt,
    );
  }

  const inspPage = await req("/api/v1/inspiration/page?pageSize=5", {
    headers: { auth: false },
  });
  ok(
    "GET inspiration/page",
    inspPage.res.ok && Array.isArray(inspPage.json?.data?.rows),
    `total=${inspPage.json?.data?.total}`,
  );

  const firstId = inspPage.json?.data?.rows?.[0]?.id;
  if (firstId) {
    const inspDetail = await req(`/api/v1/inspiration/${firstId}`, {
      headers: { auth: false },
    });
    ok(
      "GET inspiration/:id",
      inspDetail.res.ok && typeof inspDetail.json?.data?.prompt === "string",
      `model=${inspDetail.json?.data?.modelId}`,
    );
  }

  const keywordPage = await req("/api/v1/keyword/page?pageSize=3", {
    headers: { auth: false },
  });
  ok(
    "GET keyword/page",
    keywordPage.res.ok && Array.isArray(keywordPage.json?.data?.rows),
  );

  const legacyId = keywordPage.json?.data?.rows?.[0]?.id;
  if (legacyId != null) {
    const keywordDetail = await req(`/api/v1/keyword/detail/${legacyId}`, {
      headers: { auth: false },
    });
    ok(
      "GET keyword/detail/:id",
      keywordDetail.res.ok &&
        typeof keywordDetail.json?.data?.prompt === "string" &&
        Array.isArray(keywordDetail.json?.data?.imagesList),
    );
  }

  const adminInsp = await req("/api/v1/admin/inspiration", {
    headers: { "X-Admin-Secret": ADMIN },
  });
  ok(
    "GET admin/inspiration",
    adminInsp.res.ok && Array.isArray(adminInsp.json?.data),
    `count=${adminInsp.json?.data?.length}`,
  );

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
