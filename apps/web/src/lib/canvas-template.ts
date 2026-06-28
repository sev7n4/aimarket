/**
 * 12.1 画布节点序列化函数
 * 将画布节点/边序列化为可保存、可复用的模板
 */
import { randomUUID } from "./uuid";
import type {
  CanvasNodeType,
  CanvasFlowNode,
  CanvasFlowEdge,
} from "./canvas-node-types";

// ─── 模板数据结构 ─────────────────────────────

/** 画布模板 */
export interface CanvasTemplate {
  id: string;
  name: string;
  description: string;
  /** 模板节点（不含实际 assetId，仅含类型和参数） */
  nodes: Array<{
    type: CanvasNodeType;
    label: string;
    params?: Record<string, unknown>;
  }>;
  /** 模板边（用节点索引而非 ID 引用） */
  edges: Array<{
    sourceIndex: number;
    targetIndex: number;
    sourceHandle?: string;
    targetHandle?: string;
  }>;
  createdAt: string;
}

// ─── 序列化 ─────────────────────────────

/**
 * 将画布节点和边序列化为模板
 * - 去除节点的 id、position、assetId、outputId 等运行时数据
 * - 将边的 source/target 从节点 ID 转为节点索引
 */
export function serializeToTemplate(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  name: string,
  description?: string,
): CanvasTemplate {
  // 建立节点 ID → 索引映射
  const nodeIndexMap = new Map<string, number>();
  nodes.forEach((n, i) => nodeIndexMap.set(n.id, i));

  // 序列化节点：仅保留类型、标签和参数
  const templateNodes = nodes.map((n) => ({
    type: n.data.type,
    label: n.data.label,
    ...(n.data.params && Object.keys(n.data.params).length > 0
      ? { params: n.data.params }
      : {}),
  }));

  // 序列化边：用索引代替 ID
  const templateEdges = edges
    .map((e) => {
      const sourceIndex = nodeIndexMap.get(e.source);
      const targetIndex = nodeIndexMap.get(e.target);
      // 跳过引用了不存在节点的边
      if (sourceIndex === undefined || targetIndex === undefined) return null;
      return {
        sourceIndex,
        targetIndex,
        ...(e.sourceHandle ? { sourceHandle: e.sourceHandle } : {}),
        ...(e.targetHandle ? { targetHandle: e.targetHandle } : {}),
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);

  return {
    id: randomUUID(),
    name,
    description: description ?? "",
    nodes: templateNodes,
    edges: templateEdges,
    createdAt: new Date().toISOString(),
  };
}

// ─── 反序列化 ─────────────────────────────

/**
 * 将模板反序列化为画布节点和边
 * - 为节点生成新的 ID、默认位置
 * - 将边的索引转回节点 ID
 */
export function deserializeTemplate(template: CanvasTemplate): {
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
} {
  // 默认间距
  const SPACING_X = 280;
  const SPACING_Y = 180;

  // 反序列化节点：生成新 ID 和默认位置
  const nodes: CanvasFlowNode[] = template.nodes.map((n, i) => {
    const id = randomUUID();
    return {
      id,
      type: n.type,
      position: {
        x: i * SPACING_X,
        y: 0,
      },
      data: {
        type: n.type,
        label: n.label,
        params: n.params,
      },
    };
  });

  // 反序列化边：索引 → 新节点 ID
  const edges: CanvasFlowEdge[] = template.edges.map((e) => ({
    id: randomUUID(),
    source: nodes[e.sourceIndex].id,
    target: nodes[e.targetIndex].id,
    ...(e.sourceHandle ? { sourceHandle: e.sourceHandle } : {}),
    ...(e.targetHandle ? { targetHandle: e.targetHandle } : {}),
  }));

  return { nodes, edges };
}
