"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  type OnNodesChange,
  type OnEdgesChange,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { ScriptNode } from "@/components/canvas-nodes/script-node";
import { ImageNode } from "@/components/canvas-nodes/image-node";
import { VideoNode } from "@/components/canvas-nodes/video-node";
import { AudioNode } from "@/components/canvas-nodes/audio-node";
import { TextNode } from "@/components/canvas-nodes/text-node";
import {
  isValidConnection,
  type CanvasFlow,
  type CanvasFlowEdge,
  type CanvasFlowNode,
  type CanvasNodeData,
  type CanvasNodeType,
} from "@/lib/canvas-node-types";
import {
  createCanvasEdge,
  deleteCanvasEdge,
  fetchCanvasFlow,
  saveCanvasFlow,
  updateCanvasNode,
  deleteCanvasNode,
} from "@/lib/api-client";

/** 节点类型映射 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes: NodeTypes = {
  script: ScriptNode as any,
  image: ImageNode as any,
  video: VideoNode as any,
  audio: AudioNode as any,
  text: TextNode as any,
};

/** 将 CanvasFlowNode 转为 React Flow Node */
function toReactFlowNode(n: CanvasFlowNode): Node<Record<string, unknown>> {
  return {
    id: n.id,
    type: n.type,
    position: n.position,
    data: { ...n.data },
  };
}

/** 将 React Flow Node 转为 CanvasFlowNode */
function fromReactFlowNode(n: Node): CanvasFlowNode {
  return {
    id: n.id,
    type: (n.type ?? "script") as CanvasNodeType,
    position: n.position,
    data: n.data as unknown as CanvasNodeData,
  };
}

/** 将 CanvasFlowEdge 转为 React Flow Edge */
function toReactFlowEdge(e: CanvasFlowEdge): Edge {
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
  };
}

/** 将 React Flow Edge 转为 CanvasFlowEdge */
function fromReactFlowEdge(e: Edge): CanvasFlowEdge {
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? undefined,
    targetHandle: e.targetHandle ?? undefined,
  };
}

interface CanvasFlowProps {
  sessionId: string;
  readOnly?: boolean;
  onNodeDoubleClick?: (nodeId: string, nodeType: CanvasNodeType) => void;
  /** 双击空白区域回调（用于弹出节点创建器） */
  onPaneDoubleClick?: (position: { x: number; y: number }) => void;
}

/**
 * 1.3 画布流组件：包装 React Flow，配置节点类型映射，
 * 处理连线验证、API 同步等逻辑
 */
export function CanvasFlowCanvas({
  sessionId,
  readOnly = false,
  onNodeDoubleClick,
  onPaneDoubleClick,
}: CanvasFlowProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const [loaded, setLoaded] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPaneClickRef = useRef<number>(0);

  // 加载画布流数据
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const flow = await fetchCanvasFlow(sessionId);
        if (cancelled) return;
        setNodes(flow.nodes.map(toReactFlowNode));
        setEdges(flow.edges.map(toReactFlowEdge));
        if (flow.viewport && reactFlowInstance.current) {
          reactFlowInstance.current.setViewport(flow.viewport);
        }
      } catch {
        // 新画布：空数据即可
      }
      setLoaded(true);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [sessionId, setNodes, setEdges]);

  // 防抖保存
  const debouncedSave = useCallback(
    (currentNodes: Node[], currentEdges: Edge[]) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const flow: CanvasFlow = {
          nodes: currentNodes.map(fromReactFlowNode),
          edges: currentEdges.map(fromReactFlowEdge),
          viewport: reactFlowInstance.current
            ? reactFlowInstance.current.getViewport()
            : undefined,
        };
        void saveCanvasFlow(sessionId, flow).catch(() => {});
      }, 800);
    },
    [sessionId],
  );

  // 节点位置变化时同步到后端（防抖）
  const handleNodesChange: OnNodesChange<Node> = useCallback(
    (changes) => {
      onNodesChange(changes);
      // 位置拖拽完成时保存
      const hasPositionChange = changes.some(
        (c) => c.type === "position" && c.dragging === false,
      );
      if (hasPositionChange) {
        const movedChange = changes.find(
          (c) => c.type === "position" && c.dragging === false && c.id,
        );
        if (movedChange && movedChange.type === "position" && movedChange.id) {
          const node = nodes.find((n) => n.id === movedChange.id);
          if (node) {
            void updateCanvasNode(sessionId, node.id, {
              position: node.position,
            }).catch(() => {});
          }
        }
      }
      // 删除节点
      const removeChanges = changes.filter((c) => c.type === "remove");
      for (const rc of removeChanges) {
        if (rc.id) {
          void deleteCanvasNode(sessionId, rc.id).catch(() => {});
        }
      }
    },
    [onNodesChange, sessionId, nodes],
  );

  // 边变化时同步
  const handleEdgesChange: OnEdgesChange<Edge> = useCallback(
    (changes) => {
      onEdgesChange(changes);
      const removeChanges = changes.filter((c) => c.type === "remove");
      for (const rc of removeChanges) {
        if (rc.id) {
          void deleteCanvasEdge(sessionId, rc.id).catch(() => {});
        }
      }
    },
    [onEdgesChange, sessionId],
  );

  // 连线创建
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      // 连线验证
      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);
      if (!sourceNode || !targetNode) return;

      const sourceType = (sourceNode.type ?? "script") as CanvasNodeType;
      const targetType = (targetNode.type ?? "script") as CanvasNodeType;

      if (
        !isValidConnection(
          sourceType,
          connection.sourceHandle ?? undefined,
          targetType,
          connection.targetHandle ?? undefined,
        )
      ) {
        return;
      }

      // 本地先添加边
      const newEdge = addEdge(
        {
          ...connection,
          type: "smoothstep",
          animated: true,
        },
        edges,
      );
      setEdges(newEdge);

      // 同步到后端
      void createCanvasEdge(sessionId, {
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle ?? undefined,
        targetHandle: connection.targetHandle ?? undefined,
      }).catch(() => {});
    },
    [nodes, edges, setEdges, sessionId],
  );

  // 连线验证回调
  const isValidConnectionFn = useCallback(
    (edgeOrConnection: Edge | Connection) => {
      const source = edgeOrConnection.source;
      const target = edgeOrConnection.target;
      if (!source || !target) return false;
      const sourceNode = nodes.find((n) => n.id === source);
      const targetNode = nodes.find((n) => n.id === target);
      if (!sourceNode || !targetNode) return false;

      return isValidConnection(
        (sourceNode.type ?? "script") as CanvasNodeType,
        edgeOrConnection.sourceHandle ?? undefined,
        (targetNode.type ?? "script") as CanvasNodeType,
        edgeOrConnection.targetHandle ?? undefined,
      );
    },
    [nodes],
  );

  // 节点双击
  const handleNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onNodeDoubleClick?.(node.id, (node.type ?? "script") as CanvasNodeType);
    },
    [onNodeDoubleClick],
  );

  // 画布空白点击（检测双击以触发节点创建器）
  const handlePaneClick = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      if (!reactFlowInstance.current || !onPaneDoubleClick) return;
      const now = Date.now();
      if (now - lastPaneClickRef.current < 350) {
        // 双击检测
        const position = reactFlowInstance.current.screenToFlowPosition({
          x: (event as MouseEvent).clientX,
          y: (event as MouseEvent).clientY,
        });
        onPaneDoubleClick(position);
        lastPaneClickRef.current = 0;
      } else {
        lastPaneClickRef.current = now;
      }
    },
    [onPaneDoubleClick],
  );

  if (!loaded) {
    return (
      <div className="flex h-full items-center justify-center text-zinc-500 text-xs">
        加载画布...
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={readOnly ? undefined : handleNodesChange}
        onEdgesChange={readOnly ? undefined : handleEdgesChange}
        onConnect={readOnly ? undefined : onConnect}
        onInit={(instance) => {
          reactFlowInstance.current = instance;
        }}
        nodeTypes={nodeTypes}
        isValidConnection={isValidConnectionFn}
        onNodeDoubleClick={handleNodeDoubleClick}
        onPaneClick={readOnly ? undefined : handlePaneClick}
        fitView
        deleteKeyCode={readOnly ? null : "Delete"}
        className="bg-[#080808]"
        defaultEdgeOptions={{
          type: "smoothstep",
          animated: true,
          style: { stroke: "#6366f1", strokeWidth: 2 },
        }}
      >
        <Background color="#1a1a2e" gap={20} />
        <Controls
          className="!border-white/10 !bg-[#0f0f0f] [&>button]:!border-white/10 [&>button]:!bg-[#0f0f0f] [&>button]:!fill-zinc-400"
        />
        <MiniMap
          className="!border-white/10 !bg-[#0f0f0f]"
          nodeColor={(node) => {
            const colors: Record<string, string> = {
              script: "#8b5cf6",
              image: "#f97316",
              video: "#06b6d4",
              audio: "#22c55e",
              text: "#f59e0b",
            };
            return colors[node.type ?? "script"] ?? "#6366f1";
          }}
          maskColor="rgba(0, 0, 0, 0.7)"
        />
      </ReactFlow>
    </div>
  );
}
