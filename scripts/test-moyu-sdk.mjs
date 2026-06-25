/**
 * C-S8 — @moyupi/skills SDK 集成测试
 *
 * 启动一个 mock HTTP 服务器模拟 moyupi OpenAPI，
 * 验证 SDK 的 client / errors / webhooks / polling 行为。
 *
 * 运行：
 *   node scripts/test-moyu-sdk.mjs
 */
import { createServer } from "node:http";

const results = [];
function ok(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

// ============ Mock Server ============
const MOCK_PORT = 48127;
const MOCK_BASE = `http://127.0.0.1:${MOCK_PORT}`;

const VALID_KEY = "moyu_sk_test_abcdef";
const sessions = new Map();
const plans = new Map();
const webhookSecret = "test_secret_12345";

const server = createServer((req, res) => {
  // 健康检查
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "aimarket-api", version: "0.0.1-mock" }));
    return;
  }

  // 校验 API key
  const apiKey = req.headers["x-api-key"];
  if (apiKey !== VALID_KEY) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "无效的 API Key" } }));
    return;
  }

  // 路由
  if (req.method === "POST" && req.url === "/api/v1/open/sessions") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const input = JSON.parse(body || "{}");
      const id = `sess_${Date.now()}`;
      const session = {
        id,
        title: input.title ?? "mock",
        mode: input.mode ?? "production",
        kind: input.kind ?? "canvas",
        status: "idle",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      sessions.set(id, session);
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: session }));
    });
    return;
  }

  if (req.method === "GET" && req.url?.startsWith("/api/v1/open/sessions/")) {
    const id = req.url.split("/").pop();
    let session = sessions.get(id);
    if (!session) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { code: "NOT_FOUND", message: "session not found" } }));
      return;
    }
    // 模拟状态推进：第 2 次访问时进入 running，第 3 次进入 completed
    const accessCount = session._accessCount ?? 0;
    session._accessCount = accessCount + 1;
    if (accessCount === 0) session = { ...session, status: "running" };
    else if (accessCount === 1) session = { ...session, status: "completed" };
    sessions.set(id, session);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ data: { ...session, _accessCount: undefined } }));
    return;
  }

  if (req.method === "POST" && req.url === "/api/v1/open/drama/plan") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const input = JSON.parse(body);
      const id = `plan_${Date.now()}`;
      const planRun = {
        id,
        sessionId: input.sessionId,
        userIdea: input.userIdea,
        projectType: input.projectType ?? "short_drama",
        status: "queued",
        projectId: null,
        error: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      plans.set(id, planRun);
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: planRun }));
    });
    return;
  }

  if (req.method === "POST" && req.url === "/api/v1/open/drama/produce") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const input = JSON.parse(body);
      const id = `run_${Date.now()}`;
      const run = {
        id,
        sessionId: input.sessionId,
        projectId: input.projectId,
        status: "running",
        error: null,
        estimatedPoints: 100,
        finalVideoUrl: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: run }));
    });
    return;
  }

  if (req.method === "POST" && req.url === "/api/v1/open/webhooks") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const input = JSON.parse(body);
      const id = `hook_${Date.now()}`;
      const result = {
        id,
        url: input.url,
        events: input.events,
        hasSecret: true,
        createdAt: new Date().toISOString(),
        secret: input.secret ?? webhookSecret,
      };
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: result }));
    });
    return;
  }

  if (req.method === "POST" && req.url === "/api/v1/open/echo-404") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: { code: "NOT_FOUND", message: "echo 404" } }));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: { code: "NOT_FOUND", message: "unknown route" } }));
});

// ============ 加载 SDK（dist 已编译则用 dist，否则用 tsx 加载 src） ============
let MoyuClient, MoyuWebhook, MoyuError, MoyuConfigError, MoyuTimeoutError, isWebhookEvent, isTerminalStatus, SDK_VERSION;
try {
  // 优先用编译后的 dist（生产环境）
  const sdk = await import("../packages/moyu-skills-sdk/dist/index.js");
  MoyuClient = sdk.MoyuClient;
  MoyuWebhook = sdk.MoyuWebhook;
  MoyuError = sdk.MoyuError;
  MoyuConfigError = sdk.MoyuConfigError;
  MoyuTimeoutError = sdk.MoyuTimeoutError;
  isWebhookEvent = sdk.isWebhookEvent;
  isTerminalStatus = sdk.isTerminalStatus;
  SDK_VERSION = sdk.SDK_VERSION;
  console.log(`(使用 dist 版本 v${SDK_VERSION})`);
} catch {
  // fallback：用 tsx 加载 ts 源码（开发环境）
  const sdk = await import("../packages/moyu-skills-sdk/src/index.ts");
  MoyuClient = sdk.MoyuClient;
  MoyuWebhook = sdk.MoyuWebhook;
  MoyuError = sdk.MoyuError;
  MoyuConfigError = sdk.MoyuConfigError;
  MoyuTimeoutError = sdk.MoyuTimeoutError;
  isWebhookEvent = sdk.isWebhookEvent;
  isTerminalStatus = sdk.isTerminalStatus;
  SDK_VERSION = sdk.SDK_VERSION;
  console.log(`(使用 src 版本 v${SDK_VERSION})`);
}

await new Promise((resolve) => server.listen(MOCK_PORT, resolve));
console.log(`mock server listening on ${MOCK_BASE}\n`);

// ============ 测试用例 ============
console.log("=== @moyupi/skills SDK 集成测试 ===\n");

// 1. SDK 版本号
ok("1. SDK_VERSION 是字符串", typeof SDK_VERSION === "string" && SDK_VERSION.length > 0);

// 2. apiKey 校验
let configError = false;
try {
  new MoyuClient({ apiKey: "invalid_key" });
} catch (err) {
  configError = err instanceof MoyuConfigError;
}
ok("2. apiKey 不以 moyu_sk_ 开头时抛 MoyuConfigError", configError);

let configError2 = false;
try {
  new MoyuClient({ apiKey: "" });
} catch {
  configError2 = true;
}
ok("3. apiKey 为空时抛错", configError2);

const client = new MoyuClient({
  apiKey: VALID_KEY,
  baseUrl: MOCK_BASE,
  timeoutMs: 5000,
});

// 4. health 检查
const health = await client.health();
ok("4. health() 返回 service + version", health.service === "aimarket-api" && typeof health.version === "string");

// 5. createSession
const session = await client.createSession({ title: "SDK 测试" });
ok("5. createSession 返回 id", typeof session.id === "string" && session.id.startsWith("sess_"));
ok("6. createSession 默认 mode=production", session.mode === "production");
ok("7. createSession 默认 kind=canvas", session.kind === "canvas");

// 6. 401 错误（无效 key）
const badClient = new MoyuClient({ apiKey: "moyu_sk_invalid", baseUrl: MOCK_BASE });
let unauthorizedErr = null;
try {
  await badClient.createSession();
} catch (err) {
  unauthorizedErr = err;
}
ok("8. 无效 key 返回 401 MoyuError", unauthorizedErr instanceof MoyuError && unauthorizedErr.status === 401);
ok("9. 401 错误 code=UNAUTHORIZED", unauthorizedErr.code === "UNAUTHORIZED");

// 7. 404 错误
let notFoundErr = null;
try {
  await client.getSession("sess_does_not_exist");
} catch (err) {
  notFoundErr = err;
}
ok("10. 不存在的 session 返回 404", notFoundErr.status === 404 && notFoundErr.code === "NOT_FOUND");

// 8. startDramaPlan
const plan = await client.startDramaPlan({
  sessionId: session.id,
  userIdea: "a".repeat(20), // ≥10 字符
  projectType: "short_drama",
});
ok("11. startDramaPlan 返回 id", plan.id.startsWith("plan_"));
ok("12. plan.sessionId 一致", plan.sessionId === session.id);
ok("13. plan 默认 projectType=short_drama", plan.projectType === "short_drama");

// 9. startDramaProduce
const run = await client.startDramaProduce({
  sessionId: session.id,
  projectId: "00000000-0000-0000-0000-000000000001",
});
ok("14. startDramaProduce 返回 id", run.id.startsWith("run_"));
ok("15. run.estimatedPoints=100", run.estimatedPoints === 100);

// 10. waitDramaSession 轮询
const finalStatus = await client.waitDramaSession(session.id, {
  timeoutMs: 10_000,
  pollIntervalMs: 100,
});
ok("16. waitDramaSession 返回 completed", finalStatus === "completed");

// 11. 轮询超时
let timeoutErr = null;
const timeoutClient = new MoyuClient({ apiKey: VALID_KEY, baseUrl: MOCK_BASE });
// 用一个永远不进入终态的 session：通过手动创建
const stuckSession = await timeoutClient.createSession({ title: "stuck" });
// 让 mock 不再推进状态：把 _accessCount 撤回
const stuck = sessions.get(stuckSession.id);
if (stuck) {
  stuck._accessCount = -100; // 让它永远不到 completed
  sessions.set(stuckSession.id, stuck);
}
try {
  await timeoutClient.waitDramaSession(stuckSession.id, {
    timeoutMs: 500,
    pollIntervalMs: 100,
  });
} catch (err) {
  timeoutErr = err;
}
ok("17. 超时抛 MoyuTimeoutError", timeoutErr instanceof MoyuTimeoutError, `actual: ${timeoutErr?.name}`);

// 12. registerWebhook
const webhook = await client.registerWebhook({
  url: "https://example.com/hook",
  events: ["drama.plan.completed", "drama.run.completed"],
});
ok("18. registerWebhook 返回 id", typeof webhook.id === "string");
ok("19. webhook.hasSecret=true", webhook.hasSecret === true);
ok("20. webhook.secret 已返回", typeof webhook.secret === "string" && webhook.secret.length > 0);

// 13. MoyuWebhook.sign + verify
const body = JSON.stringify({ event: "drama.plan.completed", data: {} });
const sig = MoyuWebhook.sign(body, webhookSecret);
ok("21. sign 返回 hex 字符串", /^[0-9a-f]{64}$/.test(sig));
ok("22. verify 正确签名 → true", MoyuWebhook.verify(body, sig, webhookSecret) === true);
ok("23. verify 错误签名 → false", MoyuWebhook.verify(body, "deadbeef" + sig.slice(8), webhookSecret) === false);
ok("24. verify 错误 secret → false", MoyuWebhook.verify(body, sig, "wrong_secret") === false);
ok("25. verify 空 signature → false", MoyuWebhook.verify(body, "", webhookSecret) === false);

// 14. isWebhookEvent 类型守卫
const payload = { event: "drama.plan.completed", timestamp: "2026-01-01", data: {} };
ok("26. isWebhookEvent 匹配事件", isWebhookEvent(payload, "drama.plan.completed") === true);
ok("27. isWebhookEvent 不匹配事件", isWebhookEvent(payload, "drama.run.completed") === false);

// 15. isTerminalStatus
ok("28. isTerminalStatus(completed)=true", isTerminalStatus("completed") === true);
ok("29. isTerminalStatus(failed)=true", isTerminalStatus("failed") === true);
ok("30. isTerminalStatus(running)=false", isTerminalStatus("running") === false);
ok("31. isTerminalStatus(null)=false", isTerminalStatus(null) === false);

// 16. client.isTerminal 实例方法
ok("32. client.isTerminal(completed)=true", client.isTerminal("completed") === true);

// ============ 总结 ============
console.log("\n=== 总结 ===");
const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass).length;
console.log(`${passed}/${results.length} 通过，${failed} 失败`);

if (failed > 0) {
  console.log("\n失败项：");
  for (const r of results.filter((r) => !r.pass)) {
    console.log(`  ✗ ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
  }
}

server.close();
process.exit(failed > 0 ? 1 : 0);
