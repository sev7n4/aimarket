import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "../db/index.js";
import { AppError } from "./errors.js";
import { assertSessionRead, assertSessionWrite } from "./session-access.js";
import {
  applyFlowToLayout,
  canvasLayoutToFlow,
  newFlowNodeId,
  readCanvasLayoutFromDb,
  serializeLayout,
} from "./canvas-flow-layout-bridge.js";

/**
 * 画布流（节点式画布）存储层。
 *
 * 持久化在 image_sessions.canvas_flow（JSON 字符串）。
 * 设计目标：
 *   - HTTP 路由（routes/sessions.ts）和 MCP tools 共用同一份数据访问层
 *   - 所有公开方法都强制 userId + sessionId 做权限校验
 */

export const canvasNodeTypeSchema = z.enum([
  "script",
  "image",
  "video",
  "audio",
  "text",
  "output",
]);
export type CanvasNodeType = z.infer<typeof canvasNodeTypeSchema>;

export const edgeKindSchema = z.enum(["reference", "trigger"]);
export type EdgeKind = z.infer<typeof edgeKindSchema>;

export const canvasFlowNodeSchema = z.object({
  id: z.string().min(1).max(80),
  type: canvasNodeTypeSchema,
  position: z.object({ x: z.number(), y: z.number() }),
  data: z.record(z.unknown()).default({}),
});
export type CanvasFlowNode = z.infer<typeof canvasFlowNodeSchema>;

export const canvasFlowEdgeSchema = z.object({
  id: z.string().min(1).max(80),
  source: z.string().min(1).max(80),
  target: z.string().min(1).max(80),
  sourceHandle: z.string().max(40).optional(),
  targetHandle: z.string().max(40).optional(),
  kind: edgeKindSchema.optional(),
});
export type CanvasFlowEdge = z.infer<typeof canvasFlowEdgeSchema>;

export const canvasFlowSchema = z.object({
  nodes: z.array(canvasFlowNodeSchema),
  edges: z.array(canvasFlowEdgeSchema),
  viewport: z
    .object({ x: z.number(), y: z.number(), zoom: z.number() })
    .optional(),
});
export type CanvasFlow = z.infer<typeof canvasFlowSchema>;

const DEFAULT_LABELS: Record<CanvasNodeType, string> = {
  script: "脚本",
  image: "图片",
  video: "视频",
  audio: "音频",
  text: "文本",
  output: "输出",
};

interface CanvasFlowRow {
  canvas_layout: string | null;
  canvas_flow: string | null;
}

function loadLayoutRaw(sessionId: string) {
  const row = db
    .prepare("SELECT canvas_layout, canvas_flow FROM image_sessions WHERE id = ?")
    .get(sessionId) as CanvasFlowRow | undefined;
  return readCanvasLayoutFromDb(row);
}

function saveLayoutFromFlow(sessionId: string, flow: CanvasFlow): void {
  const layout = applyFlowToLayout(loadLayoutRaw(sessionId), flow);
  db.prepare(
    `UPDATE image_sessions SET canvas_layout = ?, updated_at = datetime('now') WHERE id = ?`,
  ).run(serializeLayout(layout), sessionId);
}

function loadCanvasFlowRaw(sessionId: string): CanvasFlow {
  return canvasLayoutToFlow(loadLayoutRaw(sessionId));
}

function saveCanvasFlow(sessionId: string, flow: CanvasFlow): void {
  saveLayoutFromFlow(sessionId, canvasFlowSchema.parse(flow));
}

/** 读取（读权限校验） */
export function getCanvasFlow(userId: string, sessionId: string): CanvasFlow {
  assertSessionRead(userId, sessionId);
  return loadCanvasFlowRaw(sessionId);
}

/** 整体替换（写权限校验） */
export function replaceCanvasFlow(
  userId: string,
  sessionId: string,
  flow: CanvasFlow,
): CanvasFlow {
  assertSessionWrite(userId, sessionId);
  const validated = canvasFlowSchema.parse(flow);
  saveCanvasFlow(sessionId, validated);
  return validated;
}

export function listCanvasNodes(
  userId: string,
  sessionId: string,
): CanvasFlowNode[] {
  return getCanvasFlow(userId, sessionId).nodes;
}

export function getCanvasNode(
  userId: string,
  sessionId: string,
  nodeId: string,
): CanvasFlowNode | null {
  const flow = getCanvasFlow(userId, sessionId);
  return flow.nodes.find((n) => n.id === nodeId) ?? null;
}

export const createCanvasNodeInputSchema = z.object({
  type: canvasNodeTypeSchema,
  position: z.object({ x: z.number(), y: z.number() }),
  label: z.string().max(100).optional(),
  data: z.record(z.unknown()).optional(),
});
export type CreateCanvasNodeInput = z.infer<typeof createCanvasNodeInputSchema>;

export function createCanvasNode(
  userId: string,
  sessionId: string,
  input: CreateCanvasNodeInput,
): CanvasFlowNode {
  assertSessionWrite(userId, sessionId);
  const body = createCanvasNodeInputSchema.parse(input);
  const flow = loadCanvasFlowRaw(sessionId);
  const id = newFlowNodeId();
  const node: CanvasFlowNode = {
    id,
    type: body.type,
    position: body.position,
    data: {
      ...(body.data ?? {}),
      type: body.type,
      label: body.label ?? DEFAULT_LABELS[body.type],
    },
  };
  flow.nodes.push(node);
  saveCanvasFlow(sessionId, flow);
  return node;
}

export const updateCanvasNodeInputSchema = z.object({
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  label: z.string().max(100).optional(),
  data: z.record(z.unknown()).optional(),
});
export type UpdateCanvasNodeInput = z.infer<typeof updateCanvasNodeInputSchema>;

export function updateCanvasNode(
  userId: string,
  sessionId: string,
  nodeId: string,
  patch: UpdateCanvasNodeInput,
): CanvasFlowNode {
  assertSessionWrite(userId, sessionId);
  const body = updateCanvasNodeInputSchema.parse(patch);
  const flow = loadCanvasFlowRaw(sessionId);
  const idx = flow.nodes.findIndex((n) => n.id === nodeId);
  if (idx === -1) throw new AppError(404, "NOT_FOUND", "节点不存在");
  const current = flow.nodes[idx]!;
  const data = { ...(current.data ?? {}) };
  if (body.position) current.position = body.position;
  if (body.label !== undefined) data.label = body.label;
  if (body.data !== undefined) {
    for (const [k, v] of Object.entries(body.data)) {
      data[k] = v;
    }
  }
  current.data = data;
  flow.nodes[idx] = current;
  saveCanvasFlow(sessionId, flow);
  return current;
}

export function deleteCanvasNode(
  userId: string,
  sessionId: string,
  nodeId: string,
): { deleted: boolean; nodeId: string; removedEdgeCount: number } {
  assertSessionWrite(userId, sessionId);
  const flow = loadCanvasFlowRaw(sessionId);
  const idx = flow.nodes.findIndex((n) => n.id === nodeId);
  if (idx === -1) throw new AppError(404, "NOT_FOUND", "节点不存在");
  flow.nodes.splice(idx, 1);
  const before = flow.edges.length;
  flow.edges = flow.edges.filter(
    (e) => e.source !== nodeId && e.target !== nodeId,
  );
  const removedEdgeCount = before - flow.edges.length;
  saveCanvasFlow(sessionId, flow);
  return { deleted: true, nodeId, removedEdgeCount };
}

export function listCanvasEdges(
  userId: string,
  sessionId: string,
): CanvasFlowEdge[] {
  return getCanvasFlow(userId, sessionId).edges;
}

export const createCanvasEdgeInputSchema = z.object({
  source: z.string().min(1).max(80),
  target: z.string().min(1).max(80),
  sourceHandle: z.string().max(40).optional(),
  targetHandle: z.string().max(40).optional(),
  kind: edgeKindSchema.optional(),
});
export type CreateCanvasEdgeInput = z.infer<typeof createCanvasEdgeInputSchema>;

export function createCanvasEdge(
  userId: string,
  sessionId: string,
  input: CreateCanvasEdgeInput,
): CanvasFlowEdge {
  assertSessionWrite(userId, sessionId);
  const body = createCanvasEdgeInputSchema.parse(input);
  const flow = loadCanvasFlowRaw(sessionId);
  // 节点必须存在
  const sourceExists = flow.nodes.some((n) => n.id === body.source);
  const targetExists = flow.nodes.some((n) => n.id === body.target);
  if (!sourceExists || !targetExists) {
    throw new AppError(400, "INVALID_EDGE", "源/目标节点不存在");
  }
  const edge: CanvasFlowEdge = {
    id: randomUUID(),
    source: body.source,
    target: body.target,
    sourceHandle: body.sourceHandle,
    targetHandle: body.targetHandle,
    kind: body.kind ?? "trigger",
  };
  flow.edges.push(edge);
  saveCanvasFlow(sessionId, flow);
  return edge;
}

export function deleteCanvasEdge(
  userId: string,
  sessionId: string,
  edgeId: string,
): { deleted: boolean; edgeId: string } {
  assertSessionWrite(userId, sessionId);
  const flow = loadCanvasFlowRaw(sessionId);
  const idx = flow.edges.findIndex((e) => e.id === edgeId);
  if (idx === -1) throw new AppError(404, "NOT_FOUND", "边不存在");
  flow.edges.splice(idx, 1);
  saveCanvasFlow(sessionId, flow);
  return { deleted: true, edgeId };
}
