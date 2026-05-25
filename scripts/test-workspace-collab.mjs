#!/usr/bin/env node
/**
 * 方案 B：团队空间全员可见；member 对他人会话只读；owner/admin 可写
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

async function register(prefix) {
  const ts = Date.now();
  const email = `${prefix}_${ts}@test.local`;
  const reg = await req("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password: "testpass123" }),
  });
  return { email, token: reg.json?.data?.token, H: { Authorization: `Bearer ${reg.json?.data?.token}` } };
}

async function main() {
  const owner = await register("owner");
  const member = await register("member");
  if (!owner.token || !member.token) {
    console.error("注册失败");
    process.exit(1);
  }

  const teamRes = await req("/api/v1/workspaces/create", {
    method: "POST",
    headers: owner.H,
    body: JSON.stringify({ name: "协作测试团队" }),
  });
  const teamId = teamRes.json?.data?.id;
  ok("创建团队", teamRes.ok && !!teamId);

  const invite = await req(`/api/v1/workspaces/${teamId}/invites`, {
    method: "POST",
    headers: owner.H,
    body: JSON.stringify({ role: "member" }),
  });
  const code = invite.json?.data?.code;
  ok("生成邀请", invite.ok && !!code);

  const join = await req("/api/v1/workspaces/join", {
    method: "POST",
    headers: member.H,
    body: JSON.stringify({ code }),
  });
  ok("成员加入", join.ok);

  const sessionId = crypto.randomUUID();
  await req("/api/v1/imageSession/ensure", {
    method: "POST",
    headers: owner.H,
    body: JSON.stringify({
      sessionId,
      mode: "chat",
      kind: "canvas",
      workspaceId: teamId,
      title: "Owner协作会话",
    }),
  });

  const ownerList = await req(
    `/api/v1/imageSession/list?workspaceId=${teamId}&limit=50`,
    { headers: owner.H },
  );
  const ownerSees = ownerList.json?.data?.some((s) => s.id === sessionId);
  ok("Owner 列表可见", ownerSees);

  const memberList = await req(
    `/api/v1/imageSession/list?workspaceId=${teamId}&limit=50`,
    { headers: member.H },
  );
  const memberRow = memberList.json?.data?.find((s) => s.id === sessionId);
  ok("Member 列表可见团队会话", !!memberRow);
  ok("Member can_edit=false", memberRow?.can_edit === false);

  const memberPatch = await req(`/api/v1/imageSession/${sessionId}`, {
    method: "PATCH",
    headers: member.H,
    body: JSON.stringify({ title: "Member 篡改" }),
  });
  ok("Member PATCH 403", memberPatch.status === 403);

  const ownerPatch = await req(`/api/v1/imageSession/${sessionId}`, {
    method: "PATCH",
    headers: owner.H,
    body: JSON.stringify({ title: "Owner 可改" }),
  });
  ok("Owner PATCH 成功", ownerPatch.ok);

  const msgs = await req(`/api/v1/imageSession/${sessionId}/messages`, {
    headers: member.H,
  });
  ok("Member 可读消息", msgs.ok && msgs.json?.meta?.can_edit === false);

  console.log("\n完成");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
