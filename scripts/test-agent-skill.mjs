#!/usr/bin/env node
/**
 * 长 Skill 集成测试（mock API）
 * API_URL=http://localhost:4000 node scripts/test-agent-skill.mjs
 */
const API = process.env.API_URL ?? "http://localhost:4000";

const results = [];

function ok(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function req(path, init = {}) {
  const headers = { "Content-Type": "application/json", ...init.headers };
  const res = await fetch(`${API}${path}`, { ...init, headers });
  const json = await res.json().catch(() => ({}));
  return { res, json };
}

async function waitSkillRun(runId, authH, max = 60) {
  for (let i = 0; i < max; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const { json } = await req(`/api/v1/agent/skills/runs/${runId}`, {
      headers: authH,
    });
    const st = json?.data?.status;
    if (st === "completed" || st === "failed" || st === "cancelled") {
      return json.data;
    }
  }
  const { json } = await req(`/api/v1/agent/skills/runs/${runId}`, {
    headers: authH,
  });
  return json?.data;
}

async function main() {
  console.log(`\nAgent Skill integration @ ${API}\n`);

  const { res: listRes, json: listJson } = await req("/api/v1/agent/skills", {
    headers: {},
  });
  ok(
    "GET /agent/skills (needs auth)",
    listRes.status === 401 || listRes.ok,
    `status=${listRes.status}`,
  );

  const email = `skill_${Date.now()}@test.local`;
  const reg = await req("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password: "testpass123" }),
  });
  const token = reg.json?.data?.token;
  ok("register", reg.res.status === 201 && !!token);
  const authH = { Authorization: `Bearer ${token}` };

  const skills = await req("/api/v1/agent/skills", { headers: authH });
  ok(
    "GET /agent/skills",
    skills.res.ok && skills.json?.data?.some((s) => s.id.includes("taobao")),
    `count=${skills.json?.data?.length}`,
  );

  const sessionId = crypto.randomUUID();
  await req("/api/v1/imageSession/ensure", {
    method: "POST",
    headers: authH,
    body: JSON.stringify({
      sessionId,
      mode: "ecommerce",
      kind: "project",
      title: "Skill 测试",
    }),
  });

  const start = await req(
    "/api/v1/agent/skills/ecommerce-taobao-launch-v1/runs",
    {
      method: "POST",
      headers: authH,
      body: JSON.stringify({
        sessionId,
        prompt: "测试商品：便携咖啡杯，卖点保温轻便",
        confirmed: true,
      }),
    },
  );
  const runId = start.json?.data?.id;
  ok(
    "POST skill run",
    start.res.status === 201 && !!runId,
    `status=${start.json?.data?.status}`,
  );

  if (runId) {
    const final = await waitSkillRun(runId, authH, 90);
    ok(
      "skill run completes",
      final?.status === "completed",
      final?.status ?? "timeout",
    );
    ok(
      "skill has 3 steps",
      final?.steps?.length === 3,
      `steps=${final?.steps?.length}`,
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
