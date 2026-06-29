#!/usr/bin/env node
/**
 * P4.5 — Canvas MCP HTTP transport 端冒烟自测
 *
 * 验证：
 *   1) 无 token → 401
 *   2) 有效 token + JSON-RPC initialize + tools/list → 200 + 10 个 tool
 *
 * 用法: API_URL=http://localhost:4000 ADMIN_SECRET=... node scripts/verify-canvas-mcp-http.mjs
 */

const API = process.env.API_URL ?? "http://localhost:4000";

const results = [];
function ok(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function req(path, init = {}) {
  const res = await fetch(`${API}${path}`, init);
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* not json */
  }
  return { res, json };
}

async function main() {
  // 1) 无 token → 401
  const noAuth = await req("/api/v1/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "verify", version: "0.0.1" },
      },
    }),
  });
  ok(
    "无 token → 401",
    noAuth.res.status === 401,
    `status=${noAuth.res.status}`,
  );

  // 2) 注册一个测试账号拿 token
  const email = `mcp-verify-${Date.now()}@test.local`;
  const reg = await req("/api/v1/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "TestPass123", inviteCode: "" }),
  });
  if (!reg.res.ok) {
    ok("注册测试账号", false, JSON.stringify(reg.json));
    return;
  }
  const token = reg.json?.data?.token;
  ok("注册测试账号", typeof token === "string" && token.length > 0);

  // 3) 带 token initialize
  const init = await req("/api/v1/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "verify", version: "0.0.1" },
      },
    }),
  });
  ok(
    "initialize → 200",
    init.res.status === 200,
    `status=${init.res.status}`,
  );
  ok(
    "initialize 返回 serverInfo.name",
    init.json?.result?.serverInfo?.name === "aimarket-canvas",
    init.json?.result?.serverInfo?.name,
  );

  // 4) tools/list（带 Mcp-Session-Id 取自上一响应头）
  const sessionId =
    init.res.headers.get("mcp-session-id") ??
    init.res.headers.get("Mcp-Session-Id") ??
    null;
  const toolsList = await req("/api/v1/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${token}`,
      ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
    }),
  });
  ok(
    "tools/list → 200",
    toolsList.res.status === 200,
    `status=${toolsList.res.status}`,
  );
  const toolNames =
    toolsList.json?.result?.tools?.map((t) => t.name) ?? [];
  ok(
    "tools/list 返回 10 个 tool",
    toolNames.length === 10,
    `${toolNames.length} 个: ${toolNames.join(", ")}`,
  );

  // 5) tools/call canvas_list_nodes（验证工具可调用 — 用合法 UUID sessionId）
  const sessionUuid = crypto.randomUUID();
  const ensureRes = await req(
    `/api/v1/imageSession/ensure`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        sessionId: sessionUuid,
        mode: "chat",
        title: "MCP verify",
      }),
    },
  );
  if (!ensureRes.res.ok) {
    ok("ensure session", false, JSON.stringify(ensureRes.json));
    return;
  }
  ok("ensure session", true);

  const call = await req("/api/v1/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${token}`,
      ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "canvas_list_nodes",
        arguments: { sessionId: sessionUuid },
      },
    }),
  });
  ok(
    "tools/call canvas_list_nodes → 200",
    call.res.status === 200,
    `status=${call.res.status}`,
  );
  const content = call.json?.result?.content?.[0]?.text;
  let parsed = null;
  try {
    parsed = content ? JSON.parse(content) : null;
  } catch {
    /* */
  }
  ok(
    "canvas_list_nodes 返回 {count: 0, nodes: []}",
    parsed?.count === 0 && Array.isArray(parsed?.nodes),
    parsed ? `count=${parsed.count}` : "parse fail",
  );

  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} 通过\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("verify crashed:", e);
  process.exit(2);
});
