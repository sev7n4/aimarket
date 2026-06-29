/**
 * P4.5 — Canvas MCP server tools 单测
 *
 * 用临时 sqlite db + InMemoryTransport 跑 10 个 tool 的端到端测试。
 *
 * pnpm --filter @aimarket/api exec tsx ../../scripts/test-canvas-mcp-tools.ts
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const results: { name: string; pass: boolean; detail?: string }[] = [];
function ok(name: string, pass: boolean, detail?: string) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  // 1) 准备临时 db（隔离 + 自动清理）
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "canvas-mcp-test-"));
  const dbPath = path.join(tmpDir, "test.db");
  process.env.DATABASE_PATH = dbPath;
  process.env.NODE_ENV = "test";

  // 2) 触发 db 模块初始化（建表 + 迁移）
  const { db } = await import("../apps/api/src/db/index.js");

  // 3) seed 必要的 user + session
  const userId = "test-user-1";
  const sessionId = "test-session-1";
  db.prepare(
    `INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)`,
  ).run(userId, `${userId}@test.local`, "x");
  db.prepare(
    `INSERT INTO image_sessions (id, user_id, title, mode) VALUES (?, ?, ?, ?)`,
  ).run(sessionId, userId, "mcp test", "chat");

  // 4) 准备 McpServer + InMemoryTransport + Client
  // SDK 的 inMemory 是 dist root 暴露，没在 package.json exports 中；
  // 用 file:// 绝对路径绕过 tsx 解析。
  const { pathToFileURL } = await import("node:url");
  // process.cwd() 由调用方决定（apps/api 目录），因此用脚本位置作为锚点
  const scriptDir = path.dirname(new URL(import.meta.url).pathname);
  const repoRoot = path.resolve(scriptDir, "..");
  const apiSdk = path.join(
    repoRoot,
    "apps/api/node_modules/@modelcontextprotocol/sdk/dist/esm/",
  );
  const apiSrc = path.join(
    repoRoot,
    "apps/api/src/mcp/canvas-server.ts",
  );
  const { InMemoryTransport } = await import(
    pathToFileURL(path.join(apiSdk, "inMemory.js")).href
  );
  const { Client } = await import(
    pathToFileURL(path.join(apiSdk, "client/index.js")).href
  );
  const { createCanvasMcpServer } = await import(
    pathToFileURL(apiSrc).href
  );

  const client = new Client({ name: "mcp-test", version: "0.0.1" });
  const server = createCanvasMcpServer(userId);
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(ct), server.connect(st)]);

  // 5) 验证：列出 tool
  const { tools } = await client.listTools();
  const expectedTools = [
    "canvas_list_nodes",
    "canvas_get_node",
    "canvas_create_node",
    "canvas_update_node",
    "canvas_delete_node",
    "canvas_list_edges",
    "canvas_create_edge",
    "canvas_delete_edge",
    "canvas_get_flow",
    "canvas_replace_flow",
  ];
  ok(
    "10 个 tool 注册",
    tools.length === 10 &&
      expectedTools.every((n) =>
        tools.some((t: { name: string }) => t.name === n),
      ),
    `实际 ${tools.length} 个`,
  );

  // 6) canvas_get_flow 初始空
  const flow0 = await client.callTool({
    name: "canvas_get_flow",
    arguments: { sessionId },
  });
  const flow0Data = JSON.parse(
    (flow0.content as Array<{ text: string }>)[0]!.text,
  );
  ok(
    "初始 canvas_get_flow 空",
    flow0Data.nodes.length === 0 && flow0Data.edges.length === 0,
  );

  // 7) canvas_create_node x2
  const a = await client.callTool({
    name: "canvas_create_node",
    arguments: {
      sessionId,
      type: "script",
      position: { x: 0, y: 0 },
      label: "A",
    },
  });
  const nodeA = JSON.parse(
    (a.content as Array<{ text: string }>)[0]!.text,
  );
  ok(
    "canvas_create_node 返回带 id",
    typeof nodeA.id === "string" && nodeA.id.length > 0,
  );

  const b = await client.callTool({
    name: "canvas_create_node",
    arguments: {
      sessionId,
      type: "image",
      position: { x: 200, y: 0 },
      label: "B",
    },
  });
  const nodeB = JSON.parse(
    (b.content as Array<{ text: string }>)[0]!.text,
  );

  // 8) canvas_list_nodes 返回 2 个
  const list = await client.callTool({
    name: "canvas_list_nodes",
    arguments: { sessionId },
  });
  const listData = JSON.parse(
    (list.content as Array<{ text: string }>)[0]!.text,
  );
  ok("canvas_list_nodes 2 个", listData.count === 2);

  // 9) canvas_get_node 找到
  const g = await client.callTool({
    name: "canvas_get_node",
    arguments: { sessionId, nodeId: nodeA.id },
  });
  const gData = JSON.parse(
    (g.content as Array<{ text: string }>)[0]!.text,
  );
  ok(
    "canvas_get_node 找到 A",
    gData.id === nodeA.id && gData.data.label === "A",
  );

  // 10) canvas_update_node 改 label
  const u = await client.callTool({
    name: "canvas_update_node",
    arguments: { sessionId, nodeId: nodeA.id, label: "A2" },
  });
  const uData = JSON.parse(
    (u.content as Array<{ text: string }>)[0]!.text,
  );
  ok("canvas_update_node label", uData.data.label === "A2");

  // 11) canvas_create_edge
  const e = await client.callTool({
    name: "canvas_create_edge",
    arguments: {
      sessionId,
      source: nodeA.id,
      target: nodeB.id,
      kind: "trigger",
    },
  });
  const edge = JSON.parse(
    (e.content as Array<{ text: string }>)[0]!.text,
  );
  ok("canvas_create_edge trigger", edge.kind === "trigger");

  // 12) canvas_create_edge reference
  const e2 = await client.callTool({
    name: "canvas_create_edge",
    arguments: {
      sessionId,
      source: nodeB.id,
      target: nodeA.id,
      kind: "reference",
    },
  });
  const edge2 = JSON.parse(
    (e2.content as Array<{ text: string }>)[0]!.text,
  );
  ok("canvas_create_edge reference", edge2.kind === "reference");

  // 13) canvas_list_edges
  const le = await client.callTool({
    name: "canvas_list_edges",
    arguments: { sessionId },
  });
  const leData = JSON.parse(
    (le.content as Array<{ text: string }>)[0]!.text,
  );
  ok("canvas_list_edges 2 条", leData.count === 2);

  // 14) canvas_get_flow 完整
  const flow1 = await client.callTool({
    name: "canvas_get_flow",
    arguments: { sessionId },
  });
  const flow1Data = JSON.parse(
    (flow1.content as Array<{ text: string }>)[0]!.text,
  );
  ok(
    "canvas_get_flow 2 节点 2 边",
    flow1Data.nodes.length === 2 && flow1Data.edges.length === 2,
  );

  // 15) canvas_delete_edge + canvas_delete_node
  const delEdge = await client.callTool({
    name: "canvas_delete_edge",
    arguments: { sessionId, edgeId: edge.id },
  });
  ok(
    "canvas_delete_edge 成功",
    !delEdge.isError,
    delEdge.isError
      ? (delEdge.content as Array<{ text: string }>)[0]?.text
      : undefined,
  );
  const delNode = await client.callTool({
    name: "canvas_delete_node",
    arguments: { sessionId, nodeId: nodeA.id },
  });
  const delNodeData = JSON.parse(
    (delNode.content as Array<{ text: string }>)[0]!.text,
  );
  ok(
    "canvas_delete_node 成功",
    delNodeData.deleted === true,
    delNode.isError
      ? (delNode.content as Array<{ text: string }>)[0]?.text
      : `got=${JSON.stringify(delNodeData)}`,
  );

  // 16) canvas_replace_flow 整体替换（独立测试 — 不依赖前面的 node/edge id）
  const rep = await client.callTool({
    name: "canvas_replace_flow",
    arguments: {
      sessionId,
      flow: {
        nodes: [
          { type: "text", position: { x: 50, y: 50 }, label: "X" },
          { type: "text", position: { x: 250, y: 50 }, label: "Y" },
        ],
        edges: [{ source: "$tmp0", target: "$tmp1" }],
      },
    },
  });
  const repData = JSON.parse(
    (rep.content as Array<{ text: string }>)[0]!.text,
  );
  ok(
    "canvas_replace_flow 自动补 id",
    repData.nodes.length === 2 &&
      repData.nodes.every(
        (n: { id: string }) => n.id && n.id.length > 0,
      ),
    `id 样例: ${repData.nodes[0]?.id?.slice(0, 8)}`,
  );

  // 17) 错误路径：会话不存在 → isError + NOT_FOUND
  const errRes = await client.callTool({
    name: "canvas_get_flow",
    arguments: { sessionId: "no-such-session" },
  });
  const errData = JSON.parse(
    (errRes.content as Array<{ text: string }>)[0]!.text,
  );
  ok(
    "错误路径 → isError + NOT_FOUND",
    errRes.isError === true && errData.code === "NOT_FOUND",
  );

  // 18) 错误路径：边指向不存在的节点 → INVALID_EDGE
  const errEdge = await client.callTool({
    name: "canvas_create_edge",
    arguments: { sessionId, source: "ghost-1", target: "ghost-2" },
  });
  const errEdgeData = JSON.parse(
    (errEdge.content as Array<{ text: string }>)[0]!.text,
  );
  ok(
    "错误边 → isError + INVALID_EDGE",
    errEdge.isError === true && errEdgeData.code === "INVALID_EDGE",
  );

  // 19) canvas_get_node 找不到
  const miss = await client.callTool({
    name: "canvas_get_node",
    arguments: { sessionId, nodeId: "missing" },
  });
  ok("canvas_get_node 缺失 → isError", miss.isError === true);

  await client.close();
  await server.close();

  // 20) 清理临时 db
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }

  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} 通过\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("MCP test runner crashed:", err);
  process.exit(2);
});
