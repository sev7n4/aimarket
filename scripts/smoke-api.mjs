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
  ok(
    "POST /auth/register",
    reg.res.status === 201 && !!token && reg.json?.data?.user?.email_verified === true,
    `credits=${reg.json?.data?.user?.credits}`,
  );

  const authH = { Authorization: `Bearer ${token}` };

  const pendingEmail = `smoke_pending_${Date.now()}@example.com`;
  const pendingReg = await req("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: pendingEmail, password }),
    headers: { auth: false },
  });
  const pendingUser = pendingReg.json?.data?.user;
  const pendingToken = pendingReg.json?.data?.token;
  if (pendingUser && pendingUser.email_verified === false) {
    ok(
      "POST /auth/register (pending until verify)",
      pendingReg.res.status === 201 &&
        pendingUser.credits === 0 &&
        pendingUser.pending_credits > 0,
      `pending=${pendingUser.pending_credits}`,
    );
    const pendingH = { Authorization: `Bearer ${pendingToken}` };
    const pendingSession = crypto.randomUUID();
    await req("/api/v1/imageSession/ensure", {
      method: "POST",
      headers: pendingH,
      body: JSON.stringify({
        sessionId: pendingSession,
        mode: "chat",
        kind: "canvas",
        title: "pending-verify",
      }),
    });
    const blockedUnverified = await req("/api/v1/ai/generate", {
      method: "POST",
      headers: pendingH,
      body: JSON.stringify({
        sessionId: pendingSession,
        prompt: "smoke pending user",
        mode: "chat",
        count: 1,
        resolution: "1k",
      }),
    });
    ok(
      "POST /ai/generate EMAIL_NOT_VERIFIED",
      blockedUnverified.res.status === 403 &&
        blockedUnverified.json?.error?.code === "EMAIL_NOT_VERIFIED",
    );
  } else {
    ok(
      "POST /auth/register (pending until verify)",
      true,
      "skipped — trusted test domain",
    );
    ok("POST /ai/generate EMAIL_NOT_VERIFIED", true, "skipped");
  }

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
      toolRows.some((t) => t.id === "variation") &&
      toolRows.some((t) => t.id === "focus-edit") &&
      toolRows.find((t) => t.id === "crop")?.clientOnly === true,
    `count=${toolRows.length}`,
  );

  const deprecatedVariation = await req("/api/v1/ai/generate", {
    method: "POST",
    headers: authH,
    body: JSON.stringify({
      sessionId,
      prompt: "变体测试",
      operation: "variation",
      image: "https://example.com/a.png",
    }),
  });
  ok(
    "POST /ai/generate variation deprecated 410",
    deprecatedVariation.res.status === 410 &&
      deprecatedVariation.json?.error?.code === "USE_TOOL_ENDPOINT",
    `status=${deprecatedVariation.res.status}`,
  );

  const TINY_PNG_B64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const focusPoint = await req("/api/v1/focus/point", {
    method: "POST",
    headers: authH,
    body: JSON.stringify({
      sessionId,
      imageBase64: TINY_PNG_B64,
      x: 0.5,
      y: 0.5,
    }),
  });
  ok(
    "POST focus/point",
    focusPoint.res.ok &&
      focusPoint.json?.data?.pointId &&
      focusPoint.json?.data?.objectName,
    `provider=${focusPoint.json?.data?.provider}`,
  );

  const focusNoPoints = await req("/api/v1/tools/focus-edit/run", {
    method: "POST",
    headers: authH,
    body: JSON.stringify({ sessionId, prompt: "改成红色" }),
  });
  ok(
    "POST focus-edit FOCUS_REQUIRED",
    focusNoPoints.res.status === 400 &&
      focusNoPoints.json?.error?.code === "FOCUS_REQUIRED",
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
    const baseJob = await waitJob(jobId, authH, 25);
    ok(
      "generate job succeeded (tool ref)",
      baseJob?.status === "succeeded",
      baseJob?.status ?? "timeout",
    );
    outputId = baseJob?.outputs?.[0]?.id ?? null;
    if (!outputId) {
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
    }
    if (outputId) {
      const expandRun = await req("/api/v1/tools/expand/run", {
        method: "POST",
        headers: authH,
        body: JSON.stringify({
          sessionId,
          referenceOutputIds: [outputId],
          extend: { direction: "all" },
          resolution: "2k",
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

      const fp = focusPoint.json?.data;
      if (fp?.pointId) {
        for (const [label, intent] of [
          ["focus-edit edit", "edit"],
          ["focus-edit replace", "replace"],
        ]) {
          const feRun = await req("/api/v1/tools/focus-edit/run", {
            method: "POST",
            headers: authH,
            body: JSON.stringify({
              sessionId,
              prompt: intent === "replace" ? "红色花瓶" : "改成红色",
              intent,
              referenceOutputIds: [outputId],
              focusPoints: [
                {
                  pointId: fp.pointId,
                  objectName: fp.objectName,
                  x: 0.5,
                  y: 0.5,
                },
              ],
            }),
          });
          const feJobId = feRun.json?.data?.jobId;
          ok(
            `POST tools/${label}`,
            feRun.res.ok && !!feJobId,
            `job=${feJobId}`,
          );
          if (feJobId) {
            const feJob = await waitJob(feJobId, authH);
            ok(
              `${label} job succeeded`,
              feJob?.status === "succeeded" && !!feJob?.outputs?.[0]?.url,
              feJob?.outputs?.[0]?.url ?? feJob?.status ?? "no url",
            );
          }
        }
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

      const variationRun = await req("/api/v1/tools/variation/run", {
        method: "POST",
        headers: authH,
        body: JSON.stringify({
          sessionId,
          referenceOutputIds: [outputId],
          count: 1,
          resolution: "1k",
        }),
      });
      const variationJobId = variationRun.json?.data?.jobId;
      const variationPoints = variationRun.json?.data?.estimatedPoints;
      ok(
        "POST tools/variation with ref",
        variationRun.res.ok && !!variationJobId,
        `job=${variationJobId} points=${variationPoints}`,
      );
      ok(
        "tool points include count factor",
        typeof variationPoints === "number" && variationPoints === 10,
        `count1=${variationPoints} expected=10 (1k×1)`,
      );
      if (variationJobId) {
        const variationJob = await waitJob(variationJobId, authH);
        ok(
          "variation job succeeded",
          variationJob?.status === "succeeded" &&
            !!variationJob?.outputs?.[0]?.url,
          variationJob?.outputs?.[0]?.url ?? variationJob?.status ?? "no url",
        );
        ok(
          "variation job has image_provider",
          Boolean(variationJob?.image_provider),
          variationJob?.image_provider ?? "missing",
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
      provider.json?.data?.aliyunWanConfigured === false &&
      provider.json?.data?.aliyunWanModel === "wan2.6-t2i" &&
      provider.json?.data?.tools?.seedreamConfigured === false &&
      provider.json?.data?.moderation?.provider &&
      provider.json?.data?.tools?.cutoutProvider === "tool-cutout-mock" &&
      provider.json?.data?.tools?.cutoutMode === "auto" &&
      provider.json?.data?.tools?.cutoutHttpConfigured === false &&
      provider.json?.data?.tools?.upscaleProvider === "tool-upscale-mock" &&
      provider.json?.data?.tools?.upscaleMode === "auto" &&
      provider.json?.data?.tools?.upscaleHttpConfigured === false &&
      provider.json?.data?.tools?.enhanceProvider === "tool-upscale-mock" &&
      (provider.json?.data?.tools?.expandProvider === "tool-edit-mock" ||
        provider.json?.data?.tools?.expandProvider === "tool-wan-expand") &&
      provider.json?.data?.tools?.expandMode === "auto" &&
      provider.json?.data?.tools?.inpaintProvider === "tool-edit-mock" &&
      provider.json?.data?.tools?.focusEditProvider === "tool-edit-mock" &&
      provider.json?.data?.focusPoint?.activeProvider === "focus-mock" &&
      provider.json?.data?.tools?.editMode === "auto" &&
      provider.json?.data?.tools?.editHttpConfigured === false &&
      provider.json?.data?.tools?.expandHttpConfigured === false &&
      provider.json?.data?.tools?.genericToolProvider === "tool-mock" &&
      (provider.json?.data?.promptOptimize?.activeProvider ===
        "template-mock" ||
        provider.json?.data?.promptOptimize?.activeProvider === "openai"),
    `image=${provider.json?.data?.activeProvider} aliyunWan=${provider.json?.data?.aliyunWanConfigured} seedream=${provider.json?.data?.tools?.seedreamConfigured} cutout=${provider.json?.data?.tools?.cutoutMode}/${provider.json?.data?.tools?.cutoutHttpConfigured} upscale=${provider.json?.data?.tools?.upscaleMode}/${provider.json?.data?.tools?.upscaleHttpConfigured} edit=${provider.json?.data?.tools?.editMode}/${provider.json?.data?.tools?.editHttpConfigured}`,
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

    const inspRender = await req(`/api/v1/inspiration/${firstId}/render`, {
      method: "POST",
      headers: { auth: false },
      body: JSON.stringify({ variables: { product: "测试商品" } }),
    });
    ok(
      "POST inspiration/:id/render",
      inspRender.res.ok && typeof inspRender.json?.data?.prompt === "string",
    );

    const forkProject = await req(
      `/api/v1/inspiration/${firstId}/fork-project`,
      {
        method: "POST",
        headers: authH,
        body: JSON.stringify({ variables: { product: "Fork测试" } }),
      },
    );
    ok(
      "POST inspiration/:id/fork-project",
      forkProject.res.status === 201 &&
        forkProject.json?.data?.session?.kind === "project",
      `session=${forkProject.json?.data?.session?.id}`,
    );
  }

  const agentPlan = await req("/api/v1/agent/plan", {
    method: "POST",
    headers: authH,
    body: JSON.stringify({
      prompt: "帮我把商品抠图再扩成海报",
      mode: "chat",
    }),
  });
  ok(
    "POST agent/plan",
    agentPlan.res.ok &&
      Array.isArray(agentPlan.json?.data?.steps) &&
      (agentPlan.json?.data?.planSource === "rule" ||
        agentPlan.json?.data?.planSource === "llm"),
    `steps=${agentPlan.json?.data?.steps?.length} source=${agentPlan.json?.data?.planSource}`,
  );

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

  // BYOK 放在末尾，使用独立账号避免主流程耗尽积分
  const byokEmail = `byok_${Date.now()}@test.local`;
  const byokReg = await req("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: byokEmail, password }),
    headers: { auth: false },
  });
  const byokToken = byokReg.json?.data?.token;
  ok("POST /auth/register (BYOK user)", byokReg.res.status === 201 && !!byokToken);
  const byokAuthH = { Authorization: `Bearer ${byokToken}` };

  const providerCfgGet = await req("/api/v1/user/providerConfig", {
    headers: byokAuthH,
  });
  ok("GET /user/providerConfig", providerCfgGet.res.ok);

  const providerCfgPut = await req("/api/v1/user/providerConfig", {
    method: "PUT",
    headers: byokAuthH,
    body: JSON.stringify({
      useByok: true,
      openai: { apiKey: "sk-smoke-test-byok-key-abcdef12" },
    }),
  });
  ok(
    "PUT /user/providerConfig",
    providerCfgPut.res.ok && providerCfgPut.json?.data?.openai?.configured === true,
    providerCfgPut.json?.data?.openai?.keyHint ?? "",
  );

  const providerCfgGet2 = await req("/api/v1/user/providerConfig", {
    headers: byokAuthH,
  });
  ok(
    "GET /user/providerConfig (masked)",
    providerCfgGet2.res.ok &&
      typeof providerCfgGet2.json?.data?.openai?.keyHint === "string" &&
      !providerCfgGet2.json?.data?.openai?.keyHint?.includes("sk-smoke"),
    providerCfgGet2.json?.data?.openai?.keyHint ?? "",
  );

  const suggestByok = await req("/api/v1/ai/suggestModel", {
    method: "POST",
    headers: byokAuthH,
    body: JSON.stringify({
      mode: "chat",
      prompt: "冒烟 BYOK 路由",
      hasReferenceImages: false,
    }),
  });
  ok(
    "POST /ai/suggestModel (BYOK)",
    suggestByok.res.ok && suggestByok.json?.data?.modelId === "dall-e-3",
    suggestByok.json?.data?.reason ?? "",
  );

  const byokSessionId = crypto.randomUUID();
  await req("/api/v1/imageSession/ensure", {
    method: "POST",
    headers: byokAuthH,
    body: JSON.stringify({
      sessionId: byokSessionId,
      mode: "chat",
      kind: "canvas",
      title: "BYOK 冒烟",
    }),
  });

  const genByok = await req("/api/v1/ai/generate", {
    method: "POST",
    headers: byokAuthH,
    body: JSON.stringify({
      sessionId: byokSessionId,
      prompt: "BYOK 全链路测试",
      modelId: "dall-e-2",
      mode: "chat",
      count: 1,
      resolution: "1k",
    }),
  });
  const byokJobId = genByok.json?.data?.jobId;
  ok(
    "POST /ai/generate BYOK dall-e-2",
    genByok.res.ok &&
      !!byokJobId &&
      genByok.json?.data?.byokActive === true,
    `byokActive=${genByok.json?.data?.byokActive}`,
  );
  if (byokJobId) {
    const byokJobDone = await waitJob(byokJobId, byokAuthH, 20);
    const err = String(byokJobDone?.error ?? "");
    const routedOpenai =
      byokJobDone?.image_provider === "openai" ||
      (byokJobDone?.status === "failed" && /openai/i.test(err));
    ok(
      "BYOK job routed to OpenAI",
      routedOpenai,
      `${byokJobDone?.status} provider=${byokJobDone?.image_provider ?? "-"} ${err.slice(0, 60)}`,
    );
  }

  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} 通过\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
