/**
 * 示例 3：接收 moyupi Webhook 回调的 Node.js HTTP 服务器。
 *
 * 该示例使用原生 http 模块（无依赖），便于在任何 Node 环境跑起来。
 * 收到 webhook 后会验证签名，根据事件类型分流处理。
 *
 * 运行：
 *   pnpm --filter @moyupi/skills exec tsx examples/webhook-server.ts
 *
 * 环境变量：
 *   MOYU_WEBHOOK_SECRET - 必填，注册 webhook 时返回的 secret
 *   PORT                - 可选，默认 8787
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { MoyuWebhook, isWebhookEvent } from "../src/index.js";

const SECRET = process.env.MOYU_WEBHOOK_SECRET;
const PORT = Number(process.env.PORT ?? 8787);

if (!SECRET) {
  console.error("缺少 MOYU_WEBHOOK_SECRET 环境变量");
  process.exit(1);
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "method not allowed" }));
    return;
  }

  // 1. 读取 raw body（签名必须用未 JSON.parse 的原始字符串）
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const rawBody = Buffer.concat(chunks).toString("utf8");

  // 2. 验签
  const signature = req.headers["x-moyu-signature"] as string | undefined;
  if (!signature || !MoyuWebhook.verify(rawBody, signature, SECRET)) {
    console.warn(`[webhook] 签名校验失败 from=${req.socket.remoteAddress}`);
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "invalid signature" }));
    return;
  }

  // 3. 解析 payload
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "invalid json" }));
    return;
  }

  // 4. 分流处理
  console.log(
    `[webhook] ${payload.event} @ ${payload.timestamp}`,
    JSON.stringify(payload.data),
  );

  if (isWebhookEvent(payload, "drama.plan.completed")) {
    console.log(`  → Plan 完成，projectId=${payload.data.projectId}`);
    // 这里可以触发后续 Produce 或通知业务系统
  } else if (isWebhookEvent(payload, "drama.run.completed")) {
    console.log(`  → Run 完成，视频=${payload.data.finalVideoUrl}`);
    // 这里可以下载视频、写数据库等
  } else if (isWebhookEvent(payload, "drama.plan.failed")) {
    console.error(`  → Plan 失败：${payload.data.error}`);
  } else if (isWebhookEvent(payload, "drama.run.failed")) {
    console.error(`  → Run 失败：${payload.data.error}`);
  }

  // 5. 必须返回 2xx，否则服务端会认为投递失败
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true }));
});

server.listen(PORT, () => {
  console.log(`moyupi webhook server listening on http://0.0.0.0:${PORT}`);
  console.log("使用 ngrok 或 cloudflared 暴露公网后，在控制台注册 webhook URL");
});

// 优雅退出
process.on("SIGINT", () => {
  console.log("\nshutting down…");
  server.close(() => process.exit(0));
});
