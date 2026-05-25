#!/usr/bin/env node
/**
 * 验证工作区切换：个人 vs 团队会话列表隔离
 */
const API = process.env.API_URL ?? "http://localhost:4000";

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
  const ts = Date.now();
  const email = `switch_${ts}@test.local`;
  const password = "testpass123";

  const reg = await req("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const token = reg.json?.data?.token;
  if (!token) {
    console.error("注册失败", reg);
    process.exit(1);
  }
  const H = { Authorization: `Bearer ${token}` };

  const list0 = await req("/api/v1/workspaces/list", { headers: H });
  const personal = list0.json?.data?.find((w) => w.is_personal);
  ok("有个人工作区", !!personal, personal?.name);

  const teamRes = await req("/api/v1/workspaces/create", {
    method: "POST",
    headers: H,
    body: JSON.stringify({ name: "切换测试团队" }),
  });
  const teamId = teamRes.json?.data?.id;
  ok("创建团队", teamRes.ok && !!teamId);

  const list1 = await req("/api/v1/workspaces/list", { headers: H });
  const count = list1.json?.data?.length ?? 0;
  ok("列表含个人+团队", count >= 2, `count=${count}`);

  const personalSessionId = crypto.randomUUID();
  const teamSessionId = crypto.randomUUID();

  await req("/api/v1/imageSession/ensure", {
    method: "POST",
    headers: H,
    body: JSON.stringify({
      sessionId: personalSessionId,
      mode: "chat",
      kind: "canvas",
      workspaceId: personal.id,
      title: "仅个人-切换测试",
    }),
  });

  await req("/api/v1/imageSession/ensure", {
    method: "POST",
    headers: H,
    body: JSON.stringify({
      sessionId: teamSessionId,
      mode: "chat",
      kind: "canvas",
      workspaceId: teamId,
      title: "仅团队-切换测试",
    }),
  });

  const listPersonal = await req(
    `/api/v1/imageSession/list?workspaceId=${personal.id}&limit=50`,
    { headers: H },
  );
  const personalTitles = (listPersonal.json?.data ?? []).map((s) => s.title);
  const pHasPersonal = personalTitles.includes("仅个人-切换测试");
  const pHasTeam = personalTitles.includes("仅团队-切换测试");

  ok(
    "个人空间列表仅含个人会话",
    pHasPersonal && !pHasTeam,
    personalTitles.join(", ") || "(空)",
  );

  const listTeam = await req(
    `/api/v1/imageSession/list?workspaceId=${teamId}&limit=50`,
    { headers: H },
  );
  const teamTitles = (listTeam.json?.data ?? []).map((s) => s.title);
  const tHasTeam = teamTitles.includes("仅团队-切换测试");
  const tHasPersonal = teamTitles.includes("仅个人-切换测试");

  ok(
    "团队空间列表仅含团队会话",
    tHasTeam && !tHasPersonal,
    teamTitles.join(", ") || "(空)",
  );

  const listAll = await req("/api/v1/imageSession/list?limit=50", {
    headers: H },
  );
  const allCount = listAll.json?.data?.length ?? 0;
  ok(
    "无 workspaceId 时列表为全量",
    allCount >= 2 && allCount >= personalTitles.length,
    `all=${allCount} personal=${personalTitles.length} team=${teamTitles.length}`,
  );

  const bad = await req(
    `/api/v1/imageSession/list?workspaceId=${crypto.randomUUID()}&limit=5`,
    { headers: H },
  );
  ok("非法 workspaceId 被拒绝", bad.status === 403, String(bad.status));

  const failed = [
    !personal,
    !teamId,
    count < 2,
    !pHasPersonal || pHasTeam,
    !tHasTeam || tHasPersonal,
  ].some(Boolean);

  console.log(failed ? "\n切换验证：存在失败项" : "\n切换验证：API 层全部通过");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
