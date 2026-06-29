import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  createCanvasEdge,
  createCanvasNode,
  deleteCanvasEdge,
  deleteCanvasNode,
  getCanvasFlow,
  getCanvasNode,
  listCanvasEdges,
  listCanvasNodes,
  replaceCanvasFlow,
  updateCanvasNode,
  type CanvasFlow,
  type CanvasFlowEdge,
  type CanvasFlowNode,
} from "../lib/canvas-flow-store.js";
import { AppError } from "../lib/errors.js";

/**
 * P4.5 — 把现有 canvas API 暴露成 MCP tools，让 Codex / Claude Code 等
 * MCP-aware 客户端可以直接读/改画布。
 *
 * 每个工具都接受 sessionId 作为必填入参；userId 通过工厂闭包注入。
 */

const canvasNodeTypeSchema = z.enum([
  "script",
  "image",
  "video",
  "audio",
  "text",
  "output",
]);

const edgeKindSchema = z.enum(["reference", "trigger"]);

const positionSchema = z.object({ x: z.number(), y: z.number() });

const nodeDataSchema = z.record(z.unknown()).optional();

/** 把 AppError 转成 ToolError（返回 isError: true + JSON 文本） */
function toolError(err: unknown) {
  if (err instanceof AppError) {
    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ code: err.code, message: err.message }),
        },
      ],
    };
  }
  const message = err instanceof Error ? err.message : String(err);
  return {
    isError: true,
    content: [{ type: "text" as const, text: JSON.stringify({ code: "INTERNAL_ERROR", message }) }],
  };
}

function toolJson(data: unknown) {
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(data, null, 2) },
    ],
  };
}

/** 创建绑定 userId 的 McpServer */
export function createCanvasMcpServer(userId: string): McpServer {
  const server = new McpServer(
    { name: "aimarket-canvas", version: "0.1.0" },
    {
      capabilities: { tools: {} },
      instructions:
        "Tools to read and modify the AIMarket infinite canvas (node-based flow). " +
        "Each tool requires a sessionId. Nodes are uniquely identified by their id. " +
        "Edges use 'trigger' (default, animated solid) or 'reference' (dashed) kinds.",
    },
  );

  // 1. canvas_list_nodes
  server.tool(
    "canvas_list_nodes",
    "列出画布上的所有节点（含位置/类型/label/data）",
    { sessionId: z.string().min(1).max(80) },
    async ({ sessionId }) => {
      try {
        const nodes: CanvasFlowNode[] = listCanvasNodes(userId, sessionId);
        return toolJson({ count: nodes.length, nodes });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  // 2. canvas_get_node
  server.tool(
    "canvas_get_node",
    "按 id 获取单个节点详情",
    {
      sessionId: z.string().min(1).max(80),
      nodeId: z.string().min(1).max(80),
    },
    async ({ sessionId, nodeId }) => {
      try {
        const node = getCanvasNode(userId, sessionId, nodeId);
        if (!node) {
          return toolError(new AppError(404, "NOT_FOUND", "节点不存在"));
        }
        return toolJson(node);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  // 3. canvas_create_node
  server.tool(
    "canvas_create_node",
    "在指定 flow 坐标位置创建一个新节点，返回新节点（含服务端生成的 id）",
    {
      sessionId: z.string().min(1).max(80),
      type: canvasNodeTypeSchema,
      position: positionSchema,
      label: z.string().max(100).optional(),
      data: nodeDataSchema,
    },
    async ({ sessionId, type, position, label, data }) => {
      try {
        const node = createCanvasNode(userId, sessionId, {
          type,
          position,
          label,
          data,
        });
        return toolJson(node);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  // 4. canvas_update_node
  server.tool(
    "canvas_update_node",
    "更新已有节点的 position / label / data（merge 语义）",
    {
      sessionId: z.string().min(1).max(80),
      nodeId: z.string().min(1).max(80),
      position: positionSchema.optional(),
      label: z.string().max(100).optional(),
      data: nodeDataSchema,
    },
    async ({ sessionId, nodeId, position, label, data }) => {
      try {
        const node = updateCanvasNode(userId, sessionId, nodeId, {
          position,
          label,
          data,
        });
        return toolJson(node);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  // 5. canvas_delete_node
  server.tool(
    "canvas_delete_node",
    "删除节点（自动清理与之相连的边）",
    {
      sessionId: z.string().min(1).max(80),
      nodeId: z.string().min(1).max(80),
    },
    async ({ sessionId, nodeId }) => {
      try {
        const result = deleteCanvasNode(userId, sessionId, nodeId);
        return toolJson(result);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  // 6. canvas_list_edges
  server.tool(
    "canvas_list_edges",
    "列出画布上的所有边",
    { sessionId: z.string().min(1).max(80) },
    async ({ sessionId }) => {
      try {
        const edges: CanvasFlowEdge[] = listCanvasEdges(userId, sessionId);
        return toolJson({ count: edges.length, edges });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  // 7. canvas_create_edge
  server.tool(
    "canvas_create_edge",
    "连接两个节点。kind 默认为 trigger（动画实线），reference 表示只读引用（虚线灰）",
    {
      sessionId: z.string().min(1).max(80),
      source: z.string().min(1).max(80),
      target: z.string().min(1).max(80),
      sourceHandle: z.string().max(40).optional(),
      targetHandle: z.string().max(40).optional(),
      kind: edgeKindSchema.optional(),
    },
    async ({ sessionId, source, target, sourceHandle, targetHandle, kind }) => {
      try {
        const edge = createCanvasEdge(userId, sessionId, {
          source,
          target,
          sourceHandle,
          targetHandle,
          kind,
        });
        return toolJson(edge);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  // 8. canvas_delete_edge
  server.tool(
    "canvas_delete_edge",
    "按 id 删除一条边",
    {
      sessionId: z.string().min(1).max(80),
      edgeId: z.string().min(1).max(80),
    },
    async ({ sessionId, edgeId }) => {
      try {
        const result = deleteCanvasEdge(userId, sessionId, edgeId);
        return toolJson(result);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  // 9. canvas_get_flow
  server.tool(
    "canvas_get_flow",
    "获取完整画布（节点+边+viewport）",
    { sessionId: z.string().min(1).max(80) },
    async ({ sessionId }) => {
      try {
        const flow: CanvasFlow = getCanvasFlow(userId, sessionId);
        return toolJson(flow);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  // 10. canvas_replace_flow
  server.tool(
    "canvas_replace_flow",
    "整体替换画布（用于布局/批改后保存），会自动剔除不存在的节点引用",
    {
      sessionId: z.string().min(1).max(80),
      flow: z.object({
        nodes: z.array(
          z.object({
            id: z.string().min(1).max(80).optional(),
            type: canvasNodeTypeSchema,
            position: positionSchema,
            data: z.record(z.unknown()).optional(),
          }),
        ),
        edges: z.array(
          z.object({
            id: z.string().min(1).max(80).optional(),
            source: z.string().min(1).max(80),
            target: z.string().min(1).max(80),
            sourceHandle: z.string().max(40).optional(),
            targetHandle: z.string().max(40).optional(),
            kind: edgeKindSchema.optional(),
          }),
        ),
        viewport: z
          .object({ x: z.number(), y: z.number(), zoom: z.number() })
          .optional(),
      }),
    },
    async ({ sessionId, flow }) => {
      try {
        // 标准化 input：空 id 用 randomUUID 补齐（store schema 要求 id 非空）
        const normalized: CanvasFlow = {
          nodes: flow.nodes.map((n) => ({
            id: n.id || randomUUID(),
            type: n.type,
            position: n.position,
            data: { ...(n.data ?? {}) },
          })),
          edges: flow.edges.map((e) => ({
            id: e.id || randomUUID(),
            source: e.source,
            target: e.target,
            sourceHandle: e.sourceHandle,
            targetHandle: e.targetHandle,
            kind: e.kind,
          })),
          viewport: flow.viewport,
        };
        const result = replaceCanvasFlow(userId, sessionId, normalized);
        return toolJson(result);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  return server;
}
