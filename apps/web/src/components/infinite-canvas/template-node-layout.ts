import { getNodeSpec } from "./constants";
import { CanvasNodeType, type CanvasConnection, type CanvasNodeData } from "./types";

/** 用户保存模板中的节点槽位 */
export type TemplateNodeSlot = {
  type: string;
  title?: string;
  relX?: number;
  relY?: number;
  width?: number;
  height?: number;
  role?: string;
};

export type NodeTemplatePayload = {
  nodes: TemplateNodeSlot[];
  connections?: Array<
    | { fromNodeIndex: number; toNodeIndex: number }
    | { from: string; to: string }
  >;
};

const COLUMN_X: Partial<Record<CanvasNodeType, number>> = {
  [CanvasNodeType.Script]: 0,
  [CanvasNodeType.Character]: 500,
  [CanvasNodeType.Scene]: 500,
  [CanvasNodeType.Shot]: 1000,
};

const GAP_Y = 40;

function isNodeTemplatePayload(value: unknown): value is NodeTemplatePayload {
  if (!value || typeof value !== "object") return false;
  const nodes = (value as NodeTemplatePayload).nodes;
  return Array.isArray(nodes) && nodes.length > 0;
}

/** 从模板 JSON（完整 payload 或仅 nodeTemplate）解析布局 */
export function parseNodeTemplate(
  template: Record<string, unknown> | null | undefined,
): NodeTemplatePayload | null {
  if (!template) return null;
  if (isNodeTemplatePayload(template.nodeTemplate)) {
    return template.nodeTemplate;
  }
  if (isNodeTemplatePayload(template)) {
    return template;
  }
  return null;
}

function slotBasePosition(
  slot: TemplateNodeSlot,
  type: CanvasNodeType,
  stackIndex: number,
  nodeHeight: number,
): { x: number; y: number } {
  const height = slot.height ?? nodeHeight;
  if (slot.relX != null && slot.relY != null) {
    return {
      x: slot.relX,
      y: slot.relY + stackIndex * (height + GAP_Y),
    };
  }
  const x = COLUMN_X[type] ?? 0;
  return {
    x,
    y: stackIndex * (height + GAP_Y),
  };
}

function isDramaCanvasNode(node: CanvasNodeData): boolean {
  return node.id.startsWith("drama-");
}

/**
 * 将模板 nodeTemplate 中的相对布局应用到规划生成的 Drama 节点上。
 *
 * 匹配规则（按类型分组、顺序对齐）：
 * - 每种类型的第 N 个画布节点对齐模板中该类型的第 min(N, slots-1) 个槽位
 * - 分镜仅 1 个槽位时：所有 shot 节点从该槽位纵向堆叠（多机位分镜列）
 */
export function applyTemplateNodeLayout(
  nodes: CanvasNodeData[],
  nodeTemplate: NodeTemplatePayload,
): CanvasNodeData[] {
  const slotsByType = new Map<string, TemplateNodeSlot[]>();
  for (const slot of nodeTemplate.nodes) {
    const type = slot.type;
    if (!type) continue;
    const list = slotsByType.get(type) ?? [];
    list.push(slot);
    slotsByType.set(type, list);
  }

  const indexByType = new Map<string, number>();

  return nodes.map((node) => {
    if (!isDramaCanvasNode(node)) return node;

    const slots = slotsByType.get(node.type);
    if (!slots?.length) return node;

    const typeIndex = indexByType.get(node.type) ?? 0;
    indexByType.set(node.type, typeIndex + 1);

    const slotIndex =
      node.type === CanvasNodeType.Shot && slots.length === 1
        ? 0
        : Math.min(typeIndex, slots.length - 1);
    const stackIndex =
      node.type === CanvasNodeType.Shot && slots.length === 1 ? typeIndex : 0;

    const slot = slots[slotIndex]!;
    const spec = getNodeSpec(node.type);
    const width = slot.width ?? node.width ?? spec.width;
    const height = slot.height ?? node.height ?? spec.height;
    const position = slotBasePosition(slot, node.type, stackIndex, height);

    return {
      ...node,
      position,
      width,
      height,
    };
  });
}

export function applyTemplateLayoutToCanvas(
  canvas: { nodes: CanvasNodeData[]; connections: CanvasConnection[] },
  template: Record<string, unknown> | null | undefined,
): { nodes: CanvasNodeData[]; connections: CanvasConnection[] } {
  const nodeTemplate = parseNodeTemplate(template);
  if (!nodeTemplate) return canvas;
  return {
    nodes: applyTemplateNodeLayout(canvas.nodes, nodeTemplate),
    connections: canvas.connections,
  };
}

/** 生成 update_node Op，供 Agent 路径复用 */
export function templateLayoutToUpdateOps(
  nodes: CanvasNodeData[],
  nodeTemplate: NodeTemplatePayload,
) {
  const laidOut = applyTemplateNodeLayout(nodes, nodeTemplate);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return laidOut
    .filter((next) => {
      const prev = byId.get(next.id);
      if (!prev) return false;
      return (
        prev.position.x !== next.position.x ||
        prev.position.y !== next.position.y ||
        prev.width !== next.width ||
        prev.height !== next.height
      );
    })
    .map((node) => ({
      type: "update_node" as const,
      id: node.id,
      patch: {
        position: node.position,
        width: node.width,
        height: node.height,
      },
    }));
}
