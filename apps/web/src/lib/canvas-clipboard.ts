/**
 * 画布节点剪贴板
 * 用于 P4.2 Ctrl+C/Ctrl+V 复制粘贴节点：
 * - 复制：序列化选中节点 + 它们之间的连线到 JSON
 * - 粘贴：读取 JSON，生成新 ID 的节点/边，偏移位置避免重叠
 *
 * 使用 navigator.clipboard API（主路径）+ localStorage（降级）
 */

import type { Edge, Node } from "@xyflow/react";

/** 剪贴板内容（私有 schema，前缀防误读） */
const CLIPBOARD_KEY = "aimarket:canvas-clipboard";
const CLIPBOARD_PREFIX = "aimarket-canvas-v1:";

export interface CanvasClipboardPayload {
  /** 节点列表（不含 position 字段，由粘贴时计算） */
  nodes: Array<{
    type: string;
    data: Record<string, unknown>;
  }>;
  /** 边列表（source/target 指向 nodes 数组下标） */
  edges: Array<{
    sourceIndex: number;
    targetIndex: number;
    sourceHandle?: string | null;
    targetHandle?: string | null;
    /** kind: trigger / reference */
    kind?: "trigger" | "reference";
  }>;
  /** 复制时的画布缩放（用于保持相对位置） */
  zoom?: number;
}

/**
 * 复制选中节点到剪贴板
 * - 收集 selectedNodeIds 对应的节点
 * - 收集这些节点之间的边
 * - 序列化到 clipboard + localStorage（双写）
 */
export async function copyNodesToClipboard(
  nodes: Node[],
  edges: Edge[],
  selectedNodeIds: string[],
): Promise<{ count: number } | null> {
  if (selectedNodeIds.length === 0) return null;

  const idSet = new Set(selectedNodeIds);
  const selectedNodes = nodes.filter((n) => idSet.has(n.id));
  if (selectedNodes.length === 0) return null;

  // 选中节点之间的内部边
  const internalEdges = edges.filter(
    (e) => idSet.has(e.source) && idSet.has(e.target),
  );

  // 记录每个节点的下标用于边映射
  const idToIndex = new Map<string, number>();
  selectedNodes.forEach((n, i) => idToIndex.set(n.id, i));

  const payload: CanvasClipboardPayload = {
    nodes: selectedNodes.map((n) => ({
      type: n.type ?? "script",
      data: { ...(n.data as Record<string, unknown>) },
    })),
    edges: internalEdges.map((e) => {
      const data = (e.data as { kind?: "trigger" | "reference" } | undefined) ?? {};
      return {
        sourceIndex: idToIndex.get(e.source)!,
        targetIndex: idToIndex.get(e.target)!,
        sourceHandle: e.sourceHandle ?? null,
        targetHandle: e.targetHandle ?? null,
        kind: data.kind ?? "trigger",
      };
    }),
  };

  const serialized = CLIPBOARD_PREFIX + JSON.stringify(payload);

  // 双写：clipboard API + localStorage
  try {
    await navigator.clipboard.writeText(serialized);
  } catch {
    // 忽略 clipboard API 错误（无权限/HTTP）
  }
  try {
    localStorage.setItem(CLIPBOARD_KEY, serialized);
  } catch {
    // 忽略 localStorage 错误（quota）
  }

  return { count: selectedNodes.length };
}

/**
 * 读取剪贴板内容
 * - 优先读 navigator.clipboard
 * - 失败则读 localStorage
 */
export async function readClipboard(): Promise<CanvasClipboardPayload | null> {
  let raw: string | null = null;
  try {
    raw = await navigator.clipboard.readText();
  } catch {
    // 忽略
  }
  if (!raw || !raw.startsWith(CLIPBOARD_PREFIX)) {
    try {
      raw = localStorage.getItem(CLIPBOARD_KEY);
    } catch {
      return null;
    }
  }
  if (!raw || !raw.startsWith(CLIPBOARD_PREFIX)) return null;
  try {
    return JSON.parse(raw.slice(CLIPBOARD_PREFIX.length)) as CanvasClipboardPayload;
  } catch {
    return null;
  }
}

/** 节点 ID 生成器（避免与 React Flow 默认冲突） */
export function newCanvasNodeId(): string {
  // 使用时间戳 + 随机后缀，保证唯一性
  return `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function newCanvasEdgeId(): string {
  return `edge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
