import { getNodeSpec } from "./constants";
import { CanvasNodeType, type CanvasConnection, type CanvasNodeData, type CanvasNodeMetadata, type ViewportTransform } from "./types";

function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

export type CanvasAgentOp =
    | { type: "add_node"; id?: string; nodeType?: CanvasNodeType; title?: string; position?: { x: number; y: number }; x?: number; y?: number; width?: number; height?: number; metadata?: CanvasNodeMetadata }
    | { type: "update_node"; id: string; patch?: Partial<CanvasNodeData>; metadata?: CanvasNodeMetadata }
    | { type: "delete_node"; id?: string; ids?: string[]; nodeType?: CanvasNodeType }
    | { type: "delete_connections"; id?: string; ids?: string[]; all?: boolean }
    | { type: "connect_nodes"; id?: string; fromNodeId: string; toNodeId: string }
    | { type: "set_viewport"; viewport: ViewportTransform }
    | { type: "select_nodes"; ids: string[] }
    | { type: "group_nodes"; ids: string[]; title?: string; gap?: number; columns?: number; createLabel?: boolean }
    | { type: "run_generation"; nodeId: string; mode?: "text" | "image" | "video" | "audio"; prompt?: string }
    // ── Drama-specific Ops ──
    | { type: "update_shot_status"; shotNodeId: string; status: CanvasNodeMetadata["shotStatus"]; keyframeOutputId?: string; videoOutputId?: string }
    | { type: "update_character_ref"; characterNodeId: string; refUrl?: string; turnaroundStatus?: "draft" | "locked" }
    | { type: "update_scene_ref"; sceneNodeId: string; sceneRefUrl?: string }
    | { type: "focus_drama_node"; nodeId: string }
    // ── External Ops（不直接改 snapshot，由 design-canvas 回调 Studio）──
    | { type: "plan_drama"; idea: string; aspectRatio?: string; targetDurationSec?: number }
    | { type: "run_drama_production"; projectPatch?: Record<string, unknown> }
    | { type: "generate_character_sheet"; characterNodeId: string }
    | { type: "generate_shot_image"; shotNodeId: string }
    | { type: "generate_shot_video"; shotNodeId: string };

export type AgentExternalAction = Extract<
    CanvasAgentOp,
    | { type: "plan_drama" }
    | { type: "run_drama_production" }
    | { type: "generate_character_sheet" }
    | { type: "generate_shot_image" }
    | { type: "generate_shot_video" }
>;

/** 仅改动画布状态的 Op（可交给 applyCanvasAgentOps） */
export function isCanvasStateOp(op: CanvasAgentOp): boolean {
    return !["plan_drama", "run_drama_production", "generate_character_sheet", "generate_shot_image", "generate_shot_video"].includes(op.type);
}

/** 需 Studio/API 回调的外部 Op */
export function isExternalAgentOp(op: CanvasAgentOp): boolean {
    return !isCanvasStateOp(op);
}

export type CanvasAgentSnapshot = {
    projectId: string;
    title: string;
    nodes: CanvasNodeData[];
    connections: CanvasConnection[];
    selectedNodeIds: string[];
    viewport: ViewportTransform;
};

export function summarizeCanvasAgentOps(ops?: CanvasAgentOp[]) {
    const counts = (Array.isArray(ops) ? ops : []).reduce<Record<string, number>>((acc, op) => {
        if (!op?.type) return acc;
        acc[op.type] = (acc[op.type] || 0) + 1;
        return acc;
    }, {});
    return Object.entries(counts)
        .map(([type, count]) => `${opLabel(type)} ${count}`)
        .join("，");
}

export function applyCanvasAgentOps(snapshot: CanvasAgentSnapshot, ops?: CanvasAgentOp[]) {
    let nodes = snapshot.nodes;
    let connections = snapshot.connections;
    let selectedNodeIds = snapshot.selectedNodeIds;
    let viewport = snapshot.viewport;

    (Array.isArray(ops) ? ops : []).forEach((op, index) => {
        if (!op?.type) return;
        if (op.type === "add_node") {
            const nodeType = Object.values(CanvasNodeType).includes(op.nodeType as CanvasNodeType) ? op.nodeType! : CanvasNodeType.Text;
            const spec = getNodeSpec(nodeType);
            const node: CanvasNodeData = {
                id: op.id || `${nodeType}-${Date.now()}-${index}`,
                type: nodeType,
                title: op.title || spec.title,
                position: op.position || { x: op.x ?? index * 36, y: op.y ?? index * 36 },
                width: op.width || spec.width,
                height: op.height || spec.height,
                metadata: { ...spec.metadata, ...op.metadata },
            };
            nodes = [...nodes, node];
            selectedNodeIds = [node.id];
        }
        if (op.type === "update_node") {
            if (!op.id) return;
            nodes = nodes.map((node) => (node.id === op.id ? { ...node, ...op.patch, metadata: { ...node.metadata, ...op.patch?.metadata, ...op.metadata } } : node));
        }
        if (op.type === "delete_node") {
            const ids = new Set(op.ids || (op.id ? [op.id] : op.nodeType ? nodes.filter((node) => node.type === op.nodeType).map((node) => node.id) : []));
            nodes = nodes.filter((node) => !ids.has(node.id));
            connections = connections.filter((conn) => !ids.has(conn.fromNodeId) && !ids.has(conn.toNodeId));
            selectedNodeIds = selectedNodeIds.filter((id) => !ids.has(id));
        }
        if (op.type === "delete_connections") {
            const ids = new Set(op.ids || (op.id ? [op.id] : []));
            connections = op.all ? [] : connections.filter((conn) => !ids.has(conn.id));
        }
        if (op.type === "connect_nodes") {
            if (!op.fromNodeId || !op.toNodeId) return;
            const exists = connections.some((conn) => conn.fromNodeId === op.fromNodeId && conn.toNodeId === op.toNodeId);
            const hasNodes = nodes.some((node) => node.id === op.fromNodeId) && nodes.some((node) => node.id === op.toNodeId);
            if (!exists && hasNodes) connections = [...connections, { id: op.id || generateId(), fromNodeId: op.fromNodeId, toNodeId: op.toNodeId }];
        }
        if (op.type === "set_viewport" && op.viewport) viewport = op.viewport;
        if (op.type === "select_nodes") selectedNodeIds = (op.ids || []).filter((id) => nodes.some((node) => node.id === id));
        if (op.type === "group_nodes") {
            const memberIds = (op.ids || []).filter((id) => nodes.some((node) => node.id === id));
            if (memberIds.length === 0) return;
            const members = nodes.filter((node) => memberIds.includes(node.id));
            const groupId = `grp-${Date.now()}-${index}`;
            const gap = op.gap ?? 32;
            const columns = op.columns ?? Math.min(4, Math.max(1, Math.ceil(Math.sqrt(members.length))));
            const anchorX = Math.min(...members.map((n) => n.position.x));
            const anchorY = Math.min(...members.map((n) => n.position.y));
            const cellW = Math.max(...members.map((n) => n.width), 200);
            const cellH = Math.max(...members.map((n) => n.height), 150);
            const sorted = [...members].sort(
                (a, b) => a.position.y - b.position.y || a.position.x - b.position.x || a.id.localeCompare(b.id),
            );
            const layoutPositions = new Map(
                sorted.map((node, i) => {
                    const col = i % columns;
                    const row = Math.floor(i / columns);
                    return [
                        node.id,
                        {
                            x: anchorX + col * (cellW + gap),
                            y: anchorY + row * (cellH + gap),
                        },
                    ] as const;
                }),
            );
            nodes = nodes.map((node) => {
                const nextPos = layoutPositions.get(node.id);
                if (!nextPos) return node;
                return {
                    ...node,
                    position: nextPos,
                    metadata: { ...node.metadata, agentGroupId: groupId },
                };
            });
            const shouldLabel = op.createLabel !== false && Boolean(op.title?.trim());
            const labelOffset = 52;
            const newSelectedIds = [...memberIds];
            if (shouldLabel && op.title) {
                const labelNode: CanvasNodeData = {
                    id: `${groupId}-label`,
                    type: CanvasNodeType.Text,
                    title: op.title,
                    position: { x: anchorX, y: anchorY - labelOffset },
                    width: Math.min(480, columns * (cellW + gap) - gap),
                    height: 40,
                    metadata: {
                        content: op.title,
                        fontSize: 14,
                        agentGroupId: groupId,
                        isAgentGroupLabel: true,
                    },
                };
                nodes = [...nodes, labelNode];
                newSelectedIds.push(labelNode.id);
            }
            selectedNodeIds = newSelectedIds;
        }
        if (op.type === "run_generation" && op.nodeId) {
            nodes = nodes.map((node) =>
                node.id === op.nodeId
                    ? {
                          ...node,
                          metadata: {
                              ...node.metadata,
                              status: "loading",
                              ...(op.prompt != null ? { prompt: op.prompt } : {}),
                              ...(op.mode != null ? { generationMode: op.mode } : {}),
                          },
                      }
                    : node,
            );
            selectedNodeIds = [op.nodeId];
        }
        // ── Drama-specific ops ──
        if (op.type === "update_shot_status") {
            nodes = nodes.map((node) =>
                node.id === op.shotNodeId
                    ? { ...node, metadata: { ...node.metadata, shotStatus: op.status, ...(op.keyframeOutputId != null && { keyframeOutputId: op.keyframeOutputId }), ...(op.videoOutputId != null && { videoOutputId: op.videoOutputId }) } }
                    : node,
            );
        }
        if (op.type === "update_character_ref") {
            nodes = nodes.map((node) =>
                node.id === op.characterNodeId
                    ? { ...node, metadata: { ...node.metadata, ...(op.refUrl != null && { refUrl: op.refUrl }), ...(op.turnaroundStatus != null && { turnaroundStatus: op.turnaroundStatus }) } }
                    : node,
            );
        }
        if (op.type === "update_scene_ref") {
            nodes = nodes.map((node) =>
                node.id === op.sceneNodeId
                    ? { ...node, metadata: { ...node.metadata, ...(op.sceneRefUrl != null && { sceneRefUrl: op.sceneRefUrl }) } }
                    : node,
            );
        }
        if (op.type === "focus_drama_node") {
            const target = nodes.find((n) => n.id === op.nodeId);
            if (target) {
                selectedNodeIds = [op.nodeId];
                viewport = { x: -target.position.x + 200, y: -target.position.y + 200, k: 1 };
            }
        }
    });

    return { ...snapshot, nodes, connections, selectedNodeIds, viewport };
}

function opLabel(type: string) {
    if (type === "add_node") return "新增节点";
    if (type === "update_node") return "更新节点";
    if (type === "delete_node") return "删除节点";
    if (type === "delete_connections") return "删除连线";
    if (type === "connect_nodes") return "连接";
    if (type === "set_viewport") return "调整视图";
    if (type === "select_nodes") return "选择节点";
    if (type === "group_nodes") return "整理分组";
    if (type === "run_generation") return "触发生成";
    if (type === "plan_drama") return "规划短剧";
    if (type === "run_drama_production") return "触发制作";
    if (type === "generate_character_sheet") return "生成角色三视图";
    if (type === "generate_shot_image") return "生成分镜图";
    if (type === "generate_shot_video") return "生成分镜视频";
    if (type === "update_shot_status") return "更新分镜状态";
    if (type === "update_character_ref") return "更新角色参考";
    if (type === "update_scene_ref") return "更新场景参考";
    if (type === "focus_drama_node") return "聚焦节点";
    return type;
}
