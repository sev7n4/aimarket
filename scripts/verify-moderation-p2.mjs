#!/usr/bin/env node
/**
 * 核对 MODERATION_OUTPUT=true 与 P2 埋点
 */
const API = process.env.API_URL ?? "http://localhost:4000";
const ADMIN = process.env.ADMIN_SECRET ?? "aimarket-admin-dev";

async function req(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

function ok(name, pass, detail = "") {
  console.log(`${pass ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
  return pass;
}

async function main() {
  let failed = 0;

  const health = await req("/health");
  if (!ok("API 健康", health.ok, health.json?.version)) failed++;

  const uid = crypto.randomUUID();
  const reg = await req("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: `p2.${uid}@test.local`,
      password: "testpass123",
    }),
  });
  const token = reg.json?.data?.token;
  const H = { Authorization: `Bearer ${token}` };
  if (!ok("注册", !!token, reg.json?.error?.message ?? "")) {
    process.exit(1);
  }

  const provider = await req("/api/v1/ai/providerStatus", { headers: H });
  const mod = provider.json?.data?.moderation;
  if (
    !ok(
      "outputModeration=true",
      mod?.outputModeration === true,
      JSON.stringify(mod),
    )
  ) {
    failed++;
  }

  const sessionId = crypto.randomUUID();
  await req("/api/v1/imageSession/ensure", {
    method: "POST",
    headers: H,
    body: JSON.stringify({ sessionId, mode: "quick", kind: "canvas" }),
  });

  const gen = await req("/api/v1/ai/generate", {
    method: "POST",
    headers: H,
    body: JSON.stringify({
      sessionId,
      prompt: "一只可爱的橘猫，简约插画",
      modelId: "nano-banana",
      count: 1,
      resolution: "1k",
      mode: "quick",
    }),
  });
  const jobId = gen.json?.data?.jobId;
  if (!ok("提交生成", gen.ok && !!jobId, jobId)) failed++;

  let status = "queued";
  for (let i = 0; i < 40 && status !== "succeeded" && status !== "failed"; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const job = await req(`/api/v1/ai/jobs/${jobId}`, { headers: H });
    status = job.json?.data?.status ?? status;
  }
  ok("任务终态", status === "succeeded", status);
  if (status !== "succeeded") failed++;

  const analytics = await req("/api/v1/admin/analytics?days=1", {
    headers: { "X-Admin-Secret": ADMIN },
  });
  const byName = analytics.json?.data?.byName ?? [];
  const successCount = byName.find((r) => r.name === "generation_success")?.count ?? 0;
  const failCount = byName.find((r) => r.name === "generation_fail")?.count ?? 0;
  ok("埋点 generation_success", successCount > 0, `count=${successCount}`);
  ok("埋点 generation_fail 存在", failCount >= 0, `count=${failCount}`);

  const recent = analytics.json?.data?.recent ?? [];
  const hit = recent.find(
    (e) => e.name === "generation_success" && e.props_json?.includes(jobId),
  );
  if (!ok("最近事件含 job_id", !!hit)) failed++;

  console.log(failed ? `\n${failed} 项未通过` : "\n全部通过");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
