"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  forwardRef,
} from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
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
  type Viewport,
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
  fetchCanvasFlowVersion,
  saveCanvasFlow,
  updateCanvasNode,
  deleteCanvasNode,
} from "@/lib/api-client";
import { autoLayout } from "@/lib/canvas-layout";

/** 节点类型映射 */
const nodeTypes: NodeTypes = {
  script: ScriptNode as NodeTypes[string],
  image: ImageNode as NodeTypes[string],
  video: VideoNode as NodeTypes[string],
  audio: AudioNode as NodeTypes[string],
  text: TextNode as NodeTypes[string],
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

/** 将 CanvasFlowEdge 转为 React Flow Edge（带 kind 语义样式） */
function toReactFlowEdge(e: CanvasFlowEdge): Edge {
  const kind = e.kind ?? "trigger";
  const isReference = kind === "reference";
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
    type: "smoothstep",
    animated: !isReference,
    style: {
      stroke: isReference ? "#71717a" : "#6366f1",
      strokeWidth: 2,
      strokeDasharray: isReference ? "6 4" : undefined,
      opacity: isReference ? 0.7 : 1,
    },
    data: { kind },
  };
}

/** 将 React Flow Edge 转为 CanvasFlowEdge */
function fromReactFlowEdge(e: Edge): CanvasFlowEdge {
  const kind =
    (e.data as { kind?: "reference" | "trigger" } | undefined)?.kind ??
    "trigger";
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? undefined,
    targetHandle: e.targetHandle ?? undefined,
    kind,
  };
}

interface CanvasFlowProps {
  sessionId: string;
  readOnly?: boolean;
  onNodeDoubleClick?: (nodeId: string, nodeType: CanvasNodeType) => void;
  /** 双击空白区域回调（用于弹出节点创建器） */
  onPaneDoubleClick?: (position: { x: number; y: number }) => void;
}

export interface CanvasFlowHandle {
  /** 触发 dagre 自动布局 */
  autoLayout: () => void;
  /** 获取画布当前中心点的 flow 坐标（用于 slash 命令面板创建节点位置） */
  getCenterPosition: () => { x: number; y: number };
  /** 获取当前视口（x, y, zoom） */
  getViewport: () => Viewport;
  /** 设置缩放级别（用于 overlay 缩放按钮） */
  setZoom: (zoom: number) => void;
  /** 缩放步进（delta>0 放大，<0 缩小） */
  zoomBy: (delta: number) => void;
  /** 平移视口到指定中心点（flow 坐标） */
  panTo: (position: { x: number; y: number }) => void;
  /** 适配视图（与 fitView 相同） */
  fitView: () => void;
  /** 订阅缩放级别变化（用于 overlay 实时显示） */
  subscribeZoom: (cb: (zoom: number) => void) => () => void;
}

/**
 * 1.3 画布流组件：包装 React Flow，配置节点类型映射，
 * 处理连线验证、API 同步等逻辑
 */
export const CanvasFlowCanvas = forwardRef<CanvasFlowHandle, CanvasFlowProps>(function CanvasFlowCanvas(
  {
    sessionId,
    readOnly = false,
    onNodeDoubleClick,
    onPaneDoubleClick,
  },
  ref,
) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const [loaded, setLoaded] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPaneClickRef = useRef<number>(0);
  const lastRemoteVersionRef = useRef<string | null>(null);
  const localSaveInProgressRef = useRef(false);
  // 缩放订阅者：overlay 实时显示缩放百分比
  const zoomSubscribersRef = useRef<Set<(zoom: number) => void>>(new Set());
  // 当前缓存的视口（避免每次都读 ref）
  const [currentZoom, setCurrentZoom] = useState(1);

  /** 通知所有订阅者 */
  const notifyZoom = useCallback((zoom: number) => {
    setCurrentZoom((prev) => {
      if (Math.abs(prev - zoom) < 0.001) return prev;
      return zoom;
    });
    zoomSubscribersRef.current.forEach((cb) => cb(zoom));
  }, []);

  // dagre 自动布局：仅在客户端运行时可用
  const handleAutoLayout = useCallback(() => {
    if (nodes.length === 0) return;
    const laid = autoLayout(nodes, edges, { direction: "LR" });
    setNodes(laid);
    // 立即同步到后端
    if (reactFlowInstance.current) {
      const flow: CanvasFlow = {
        nodes: laid.map(fromReactFlowNode),
        edges: edges.map(fromReactFlowEdge),
        viewport: reactFlowInstance.current.getViewport(),
      };
      localSaveInProgressRef.current = true;
      void saveCanvasFlow(sessionId, flow)
        .then(async () => {
          const version = await fetchCanvasFlowVersion(sessionId);
          lastRemoteVersionRef.current = version;
        })
        .catch(() => {})
        .finally(() => {
          localSaveInProgressRef.current = false;
        });
    }
    // 触发 fitView
    requestAnimationFrame(() => {
      reactFlowInstance.current?.fitView({ padding: 0.2, duration: 400 });
    });
  }, [nodes, edges, setNodes, sessionId]);

  // 暴露方法给父组件（overlay 一键整理、缩放、视口控制等）
  useImperativeHandle(
    ref,
    () => ({
      autoLayout: handleAutoLayout,
      getCenterPosition: () => {
        const inst = reactFlowInstance.current;
        if (!inst) return { x: 0, y: 0 };
        const dom = document.querySelector(".react-flow") as HTMLElement | null;
        if (!dom) return { x: 0, y: 0 };
        const rect = dom.getBoundingClientRect();
        return inst.screenToFlowPosition({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        });
      },
      getViewport: () => {
        return reactFlowInstance.current?.getViewport() ?? { x: 0, y: 0, zoom: 1 };
      },
      setZoom: (zoom: number) => {
        const inst = reactFlowInstance.current;
        if (!inst) return;
        const v = inst.getViewport();
        inst.setViewport({ ...v, zoom });
        notifyZoom(zoom);
      },
      zoomBy: (delta: number) => {
        const inst = reactFlowInstance.current;
        if (!inst) return;
        const v = inst.getViewport();
        const next = Math.max(0.05, Math.min(4, v.zoom * (delta > 0 ? 1.2 : 1 / 1.2)));
        inst.setViewport({ ...v, zoom: next });
        notifyZoom(next);
      },
      panTo: (position: { x: number; y: number }) => {
        const inst = reactFlowInstance.current;
        if (!inst) return;
        const dom = document.querySelector(".react-flow") as HTMLElement | null;
        if (!dom) return;
        const rect = dom.getBoundingClientRect();
        const v = inst.getViewport();
        // 让目标 flow 坐标出现在视口中心
        // 关系: screen = flow * zoom + viewportOffset
        //  => viewportOffset = centerScreen - flow * zoom
        inst.setViewport({
          x: rect.width / 2 - position.x * v.zoom,
          y: rect.height / 2 - position.y * v.zoom,
          zoom: v.zoom,
        });
      },
      fitView: () => {
        reactFlowInstance.current?.fitView({ padding: 0.2, duration: 400 });
      },
      subscribeZoom: (cb: (zoom: number) => void) => {
        zoomSubscribersRef.current.add(cb);
        cb(currentZoom);
        return () => {
          zoomSubscribersRef.current.delete(cb);
        };
      },
    }),
    [handleAutoLayout, notifyZoom, currentZoom],
  );

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
        // 记录初始版本号
        const version = await fetchCanvasFlowVersion(sessionId);
        if (!cancelled) lastRemoteVersionRef.current = version;
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

  // 实时同步：轮询版本号，变更时重新加载（Agent 后端写入场景）
  useEffect(() => {
    if (!loaded) return;
    const POLL_INTERVAL = 2000; // 2秒轮询
    const interval = window.setInterval(async () => {
      // 本地保存中跳过，避免回环
      if (localSaveInProgressRef.current) return;
      try {
        const version = await fetchCanvasFlowVersion(sessionId);
        if (version !== lastRemoteVersionRef.current) {
          lastRemoteVersionRef.current = version;
          // 版本变化 → 重新加载完整画布流
          const flow = await fetchCanvasFlow(sessionId);
          setNodes(flow.nodes.map(toReactFlowNode));
          setEdges(flow.edges.map(toReactFlowEdge));
        }
      } catch {
        // 忽略轮询错误
      }
    }, POLL_INTERVAL);
    return () => window.clearInterval(interval);
  }, [sessionId, loaded, setNodes, setEdges]);

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
        localSaveInProgressRef.current = true;
        void saveCanvasFlow(sessionId, flow)
          .then(async () => {
            // 保存后更新本地版本号，避免轮询误触发重新加载
            const version = await fetchCanvasFlowVersion(sessionId);
            lastRemoteVersionRef.current = version;
          })
          .catch(() => {})
          .finally(() => {
            localSaveInProgressRef.current = false;
          });
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
        /** P4.1: 视口变化时通知订阅者（overlay 实时缩放百分比） */
        onMove={(_e, viewport) => {
          notifyZoom(viewport.zoom);
        }}
        /** P4.1: 视口平移/缩放结束时持久化视口（修复视口不保存的 bug） */
        onMoveEnd={() => {
          debouncedSave(nodes, edges);
        }}
        fitView
        deleteKeyCode={readOnly ? null : "Delete"}
        /** P4.1: 真正无限画布：5% - 400% 缩放范围 */
        minZoom={0.05}
        maxZoom={4}
        /** P4.1: 平移/选择/缩放默认行为（drag=pan, shift+drag=box-select, wheel=zoom） */
        panOnDrag
        selectionOnDrag={false}
        zoomOnScroll
        panOnScroll={false}
        className="bg-[#080808]"
        defaultEdgeOptions={{
          type: "smoothstep",
          animated: true,
          style: { stroke: "#6366f1", strokeWidth: 2 },
        }}
      >
        <Background
          /** P4.1: 网格随视口平移（dots 模式） */
          variant={BackgroundVariant.Dots}
          color="#1f1f3a"
          gap={24}
          size={1.2}
        />
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
              output: "#ec4899",
            };
            return colors[node.type ?? "script"] ?? "#6366f1";
          }}
          maskColor="rgba(0, 0, 0, 0.7)"
        />
      </ReactFlow>
    </div>
  );
});
