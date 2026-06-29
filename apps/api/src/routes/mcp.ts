import { Hono } from "hono";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { requireAuth, type AuthVariables } from "../middleware/auth.js";
import { createCanvasMcpServer } from "../mcp/canvas-server.js";
import { AppError } from "../lib/errors.js";

/**
 * P4.5 — Canvas MCP server via Streamable HTTP transport.
 *
 * 鉴权：复用现有 requireAuth 中间件，从 Authorization Bearer 头解析 userId。
 * Stateless：每次请求 new transport + server，不维护会话状态。
 *
 * 客户端接入示例（Codex / Claude Code）：
 *   URL:    https://<host>/api/v1/mcp
 *   Header: Authorization: Bearer <token>
 *   Method: POST（Streamable HTTP 规范，body 是 JSON-RPC 消息）
 */

const mcp = new Hono<{ Variables: AuthVariables }>();

/** POST /mcp — Streamable HTTP 主入口 */
mcp.post("/", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    throw new AppError(401, "UNAUTHORIZED", "请先登录");
  }

  // 1) 创建 transport（stateless + JSON 响应模式 — 简单可测；客户端均兼容）
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  // 2) 创建绑定 userId 的 MCP server
  const server = createCanvasMcpServer(userId);

  // 3) connect → handleRequest
  await server.connect(transport);
  try {
    const response = await transport.handleRequest(c.req.raw);
    return response;
  } finally {
    // 处理完即关闭，避免连接泄漏
    void transport.close();
  }
});

/** GET /mcp — 暂不支持 SSE 流（stateless 模式无需） */
mcp.get("/", (c) =>
  c.json(
    {
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "Canvas MCP server is stateless; use POST with JSON-RPC body.",
      },
    },
    405,
  ),
);

/** DELETE /mcp — 无状态无需关闭 */
mcp.delete("/", (c) => c.json({ data: { ok: true } }, 200));

/** 挂载在 /api/v1/mcp，使用 requireAuth 中间件 */
export const mcpRoute = new Hono();
mcpRoute.use("*", requireAuth);
mcpRoute.route("/", mcp);
