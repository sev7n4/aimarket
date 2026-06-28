/**
 * 1.4 迁移现有画布数据
 * 将现有 CanvasItem[] 转换为 CanvasFlow（节点+边）
 */

import type { CanvasItem, CanvasItemRole } from "@/lib/canvas-tools";
import {
  type CanvasFlow,
  type CanvasFlowEdge,
  type CanvasFlowNode,
  type CanvasNodeType,
  NODE_DEFAULT_PORTS,
} from "@/lib/canvas-node-types";

/**
 * 根据 CanvasItem 的 role 推断节点类型
 * - reference → image
 * - product → image
 * - output → image
 */
function inferNodeType(role?: CanvasItemRole): CanvasNodeType {
  return "image";
}

/** 节点自动布局参数 */
const MIGRATE_NODE_W = 200;
const MIGRATE_GAP_X = 300;
const MIGRATE_GAP_Y = 150;
const MIGRATE_COLS = 3;
const MIGRATE_START_X = 80;
const MIGRATE_START_Y = 80;

/**
 * 将现有 CanvasItem 数组转换为节点+边
 *
 * 转换规则：
 * - 每个 CanvasItem → CanvasFlowNode（类型根据 item.role 推断）
 * - 精修链关系（sourceItemId）→ CanvasFlowEdge
 * - 位置按批次分组自动排列
 */
export function migrateCanvasLayoutToFlow(items: CanvasItem[]): CanvasFlow {
  const nodes: CanvasFlowNode[] = [];
  const edges: CanvasFlowEdge[] = [];
  const idMap = new Map<string, string>(); // itemId → flowNodeId

  // 按批次分组
  const batchGroups = new Map<string, CanvasItem[]>();
  const noBatch: CanvasItem[] = [];

  for (const item of items) {
    if (item.batchId) {
      const group = batchGroups.get(item.batchId) ?? [];
      group.push(item);
      batchGroups.set(item.batchId, group);
    } else {
      noBatch.push(item);
    }
  }

  // 按批次排列节点
  let batchIndex = 0;
  for (const [, batchItems] of batchGroups) {
    for (let i = 0; i < batchItems.length; i++) {
      const item = batchItems[i]!;
      const col = i % MIGRATE_COLS;
      const row = Math.floor(i / MIGRATE_COLS) + batchIndex;
      const nodeId = `migrated-${item.id}`;
      idMap.set(item.id, nodeId);

      const nodeType = inferNodeType(item.role);
      const ports = NODE_DEFAULT_PORTS[nodeType];
      const defaultLabel =
        nodeType === "image"
          ? item.isVideo
            ? "视频"
            : "图片"
          : nodeType;

      nodes.push({
        id: nodeId,
        type: nodeType,
        position: {
          x: MIGRATE_START_X + col * MIGRATE_GAP_X,
          y: MIGRATE_START_Y + row * MIGRATE_GAP_Y,
        },
        data: {
          type: nodeType,
          label: item.label ?? defaultLabel,
          assetId: item.assetId,
          outputId: item.outputId,
          prompt: item.generationParams?.prompt,
          params: item.generationParams
            ? {
                modelId: item.generationParams.modelId,
                resolution: item.generationParams.resolution,
                aspectRatio: item.generationParams.aspectRatio,
                toolType: item.generationParams.toolType,
              }
            : undefined,
        },
      });
    }
    const rows = Math.ceil(batchItems.length / MIGRATE_COLS);
    batchIndex += rows;
  }

  // 无批次项
  for (let i = 0; i < noBatch.length; i++) {
    const item = noBatch[i]!;
    const col = i % MIGRATE_COLS;
    const row = Math.floor(i / MIGRATE_COLS) + batchIndex;
    const nodeId = `migrated-${item.id}`;
    idMap.set(item.id, nodeId);

    const nodeType = inferNodeType(item.role);

    nodes.push({
      id: nodeId,
      type: nodeType,
      position: {
        x: MIGRATE_START_X + col * MIGRATE_GAP_X,
        y: MIGRATE_START_Y + row * MIGRATE_GAP_Y,
      },
      data: {
        type: nodeType,
        label: item.label ?? "素材",
        assetId: item.assetId,
        outputId: item.outputId,
        prompt: item.generationParams?.prompt,
      },
    });
  }

  // 精修链关系 → 边
  let edgeIndex = 0;
  for (const item of items) {
    if (!item.sourceItemId) continue;
    const sourceNodeId = idMap.get(item.sourceItemId);
    const targetNodeId = idMap.get(item.id);
    if (!sourceNodeId || !targetNodeId) continue;

    // 找到源节点的输出端口和目标节点的输入端口
    const sourceNode = nodes.find((n) => n.id === sourceNodeId);
    const targetNode = nodes.find((n) => n.id === targetNodeId);
    if (!sourceNode || !targetNode) continue;

    const sourcePorts = NODE_DEFAULT_PORTS[sourceNode.type].filter(
      (p) => p.type === "output",
    );
    const targetPorts = NODE_DEFAULT_PORTS[targetNode.type].filter(
      (p) => p.type === "input",
    );

    if (sourcePorts.length > 0 && targetPorts.length > 0) {
      edges.push({
        id: `migrated-edge-${edgeIndex++}`,
        source: sourceNodeId,
        target: targetNodeId,
        sourceHandle: sourcePorts[0]!.id,
        targetHandle: targetPorts[0]!.id,
      });
    }
  }

  return { nodes, edges };
}
