/** Agent 画布操作工具定义与执行函数 */
import { randomUUID } from "node:crypto";
import { db } from "../../db/index.js";

// ─── 画布流内部结构类型 ────────────────────────────────────────

type CanvasFlowNodeRow = {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
};

type CanvasFlowEdgeRow = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
};

type CanvasFlowData = {
  nodes: CanvasFlowNodeRow[];
  edges: CanvasFlowEdgeRow[];
  viewport?: { x: number; y: number; zoom: number };
};

/** 从 image_sessions 表读取 canvas_flow JSON */
function loadCanvasFlow(sessionId: string): CanvasFlowData {
  const row = db
    .prepare("SELECT canvas_flow FROM image_sessions WHERE id = ?")
    .get(sessionId) as { canvas_flow: string | null } | undefined;
  if (!row?.canvas_flow) return { nodes: [], edges: [] };
  try {
    return JSON.parse(row.canvas_flow) as CanvasFlowData;
  } catch {
    return { nodes: [], edges: [] };
  }
}

/** 将 canvas_flow JSON 写回 image_sessions 表 */
function saveCanvasFlow(sessionId: string, flow: CanvasFlowData): void {
  db.prepare(
    `UPDATE image_sessions SET canvas_flow = ?, updated_at = datetime('now') WHERE id = ?`,
  ).run(JSON.stringify(flow), sessionId);
}

// ─── 10.1 Agent 画布操作工具定义 ──────────────────────────────

export const AGENT_CANVAS_TOOLS = [
  {
    name: "canvas_create_node",
    description: "在画布上创建节点。可创建脚本/图片/视频/音频/文本类型的节点。",
    parameters: {
      type: "object" as const,
      properties: {
        sessionId: { type: "string", description: "会话 ID" },
        type: {
          type: "string",
          enum: ["script", "image", "video", "audio", "text"],
          description: "节点类型",
        },
        position: {
          type: "object",
          properties: { x: { type: "number" }, y: { type: "number" } },
          description: "节点位置",
        },
        label: { type: "string", description: "节点标签" },
        prompt: { type: "string", description: "节点关联的 prompt" },
      },
      required: ["sessionId", "type", "position"],
    },
  },
  {
    name: "canvas_connect_nodes",
    description: "连接两个画布节点，建立数据流。",
    parameters: {
      type: "object" as const,
      properties: {
        sessionId: { type: "string", description: "会话 ID" },
        sourceNodeId: { type: "string", description: "源节点 ID" },
        targetNodeId: { type: "string", description: "目标节点 ID" },
        sourceHandle: { type: "string", description: "源端口" },
        targetHandle: { type: "string", description: "目标端口" },
      },
      required: ["sessionId", "sourceNodeId", "targetNodeId"],
    },
  },
  {
    name: "canvas_update_node",
    description: "更新画布节点属性。",
    parameters: {
      type: "object" as const,
      properties: {
        sessionId: { type: "string", description: "会话 ID" },
        nodeId: { type: "string", description: "节点 ID" },
        label: { type: "string", description: "新标签" },
        params: { type: "object", description: "节点参数" },
      },
      required: ["sessionId", "nodeId"],
    },
  },
  {
    name: "canvas_delete_node",
    description: "删除画布节点及其关联连线。",
    parameters: {
      type: "object" as const,
      properties: {
        sessionId: { type: "string", description: "会话 ID" },
        nodeId: { type: "string", description: "节点 ID" },
      },
      required: ["sessionId", "nodeId"],
    },
  },
];

// ─── 10.2 后端 Agent Tool 执行函数 ────────────────────────────

/** 节点类型对应的默认标签 */
const DEFAULT_LABELS: Record<string, string> = {
  script: "脚本",
  image: "图片",
  video: "视频",
  audio: "音频",
  text: "文本",
};

/** 执行画布工具调用 */
export async function executeCanvasToolCall(
  toolName: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  switch (toolName) {
    case "canvas_create_node":
      return canvasCreateNode(args);
    case "canvas_connect_nodes":
      return canvasConnectNodes(args);
    case "canvas_update_node":
      return canvasUpdateNode(args);
    case "canvas_delete_node":
      return canvasDeleteNode(args);
    default:
      throw new Error(`未知的画布工具: ${toolName}`);
  }
}

/** 创建画布节点 */
function canvasCreateNode(
  args: Record<string, unknown>,
): Record<string, unknown> {
  const sessionId = args.sessionId as string;
  const type = args.type as string;
  const position = args.position as { x: number; y: number };
  const label = args.label as string | undefined;
  const prompt = args.prompt as string | undefined;

  const flow = loadCanvasFlow(sessionId);
  const nodeId = randomUUID();
  const node: CanvasFlowNodeRow = {
    id: nodeId,
    type,
    position,
    data: {
      type,
      label: label ?? DEFAULT_LABELS[type] ?? "节点",
      ...(prompt ? { prompt } : {}),
    },
  };
  flow.nodes.push(node);
  saveCanvasFlow(sessionId, flow);

  return { nodeId, ...node };
}

/** 连接两个画布节点 */
function canvasConnectNodes(
  args: Record<string, unknown>,
): Record<string, unknown> {
  const sessionId = args.sessionId as string;
  const sourceNodeId = args.sourceNodeId as string;
  const targetNodeId = args.targetNodeId as string;
  const sourceHandle = args.sourceHandle as string | undefined;
  const targetHandle = args.targetHandle as string | undefined;

  const flow = loadCanvasFlow(sessionId);
  const edgeId = randomUUID();
  const edge: CanvasFlowEdgeRow = {
    id: edgeId,
    source: sourceNodeId,
    target: targetNodeId,
    ...(sourceHandle ? { sourceHandle } : {}),
    ...(targetHandle ? { targetHandle } : {}),
  };
  flow.edges.push(edge);
  saveCanvasFlow(sessionId, flow);

  return { edgeId, ...edge };
}

/** 更新画布节点属性 */
function canvasUpdateNode(
  args: Record<string, unknown>,
): Record<string, unknown> {
  const sessionId = args.sessionId as string;
  const nodeId = args.nodeId as string;
  const label = args.label as string | undefined;
  const params = args.params as Record<string, unknown> | undefined;

  const flow = loadCanvasFlow(sessionId);
  const nodeIndex = flow.nodes.findIndex((n) => n.id === nodeId);
  if (nodeIndex === -1) {
    throw new Error(`节点不存在: ${nodeId}`);
  }
  const node = flow.nodes[nodeIndex];
  const data = node.data as Record<string, unknown>;
  if (label !== undefined) data.label = label;
  if (params !== undefined) data.params = params;
  node.data = data;
  flow.nodes[nodeIndex] = node;
  saveCanvasFlow(sessionId, flow);

  return { nodeId, ...node };
}

/** 删除画布节点及其关联边 */
function canvasDeleteNode(
  args: Record<string, unknown>,
): Record<string, unknown> {
  const sessionId = args.sessionId as string;
  const nodeId = args.nodeId as string;

  const flow = loadCanvasFlow(sessionId);
  const nodeIndex = flow.nodes.findIndex((n) => n.id === nodeId);
  if (nodeIndex === -1) {
    throw new Error(`节点不存在: ${nodeId}`);
  }
  // 删除关联边
  flow.edges = flow.edges.filter(
    (e) => e.source !== nodeId && e.target !== nodeId,
  );
  // 删除节点
  flow.nodes.splice(nodeIndex, 1);
  saveCanvasFlow(sessionId, flow);

  return { deleted: true, nodeId };
}
