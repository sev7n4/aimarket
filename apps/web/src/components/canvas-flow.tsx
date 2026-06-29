"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
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
import { useCanvasHistory } from "@/lib/canvas-history";
import {
  copyNodesToClipboard,
  newCanvasEdgeId,
  readClipboard,
} from "@/lib/canvas-clipboard";
import {
  readCanvasBackgroundMode,
  writeCanvasBackgroundMode,
  type CanvasBackgroundMode,
} from "@/lib/canvas-background-mode";
import { computeRelatedNodeIds } from "@/lib/canvas-related-nodes";

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
  createCanvasNode,
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
  /** P4.2: 撤销 */
  undo: () => void;
  /** P4.2: 重做 */
  redo: () => void;
  /** P4.2: 复制选中节点到剪贴板 */
  copy: () => void;
  /** P4.2: 粘贴剪贴板内容到视口中心 */
  paste: () => void;
  /** P4.2: 订阅历史状态变化 */
  subscribeHistory: (cb: (state: { canUndo: boolean; canRedo: boolean }) => void) => () => void;
  /** P4.3: 设置背景主题（dots/lines/blank） */
  setBackgroundMode: (mode: "dots" | "lines" | "blank") => void;
  /** P4.3: 订阅背景主题变化 */
  subscribeBackground: (cb: (mode: "dots" | "lines" | "blank") => void) => () => void;
  /** P4.3: 获取当前背景主题 */
  getBackgroundMode: () => "dots" | "lines" | "blank";
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
  // 抑制历史 commit 的开关：远程拉取/undo/redo/load 期间不写入历史
  const suppressHistoryRef = useRef(false);
  // P4.2: 撤销/重做历史栈
  const history = useCanvasHistory({
    initial: { nodes: [], edges: [] },
  });

  /** P4.3: 背景主题（dots/lines/blank），从 localStorage 恢复 */
  const [backgroundMode, setBackgroundModeState] = useState<CanvasBackgroundMode>(
    () => readCanvasBackgroundMode(typeof window === "undefined" ? null : window.localStorage),
  );

  /** P4.4: related-node focus 焦点节点（null = 全部高亮） */
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);

  /** P4.4: 派生展示用 nodes/edges，focus 模式下非相关元素降透明度 */
  const displayNodes = useMemo(() => {
    if (!focusedNodeId) return nodes;
    const related = computeRelatedNodeIds(focusedNodeId, edges);
    return nodes.map((n) => {
      if (related.has(n.id)) return n;
      return {
        ...n,
        style: {
          ...(n.style ?? {}),
          opacity: 0.18,
          transition: "opacity 200ms",
        },
        className: `${n.className ?? ""} canvas-dimmed`.trim(),
      };
    });
  }, [nodes, edges, focusedNodeId]);

  const displayEdges = useMemo(() => {
    if (!focusedNodeId) return edges;
    const related = computeRelatedNodeIds(focusedNodeId, edges);
    return edges.map((e) => {
      const isRelated = related.has(e.source) && related.has(e.target);
      if (isRelated) return e;
      return {
        ...e,
        animated: false,
        style: {
          ...(e.style ?? {}),
          opacity: 0.08,
        },
      };
    });
  }, [edges, focusedNodeId]);

  /** P4.3: 设置背景模式（写入 localStorage） */
  const setBackgroundMode = useCallback((mode: CanvasBackgroundMode) => {
    setBackgroundModeState(mode);
    writeCanvasBackgroundMode(
      typeof window === "undefined" ? null : window.localStorage,
      mode,
    );
  }, []);

  /** P4.3: 背景主题订阅者 */
  const backgroundSubscribersRef = useRef<Set<(mode: "dots" | "lines" | "blank") => void>>(
    new Set(),
  );

  // 当 backgroundMode 变化时通知订阅者
  useEffect(() => {
    backgroundSubscribersRef.current.forEach((cb) => cb(backgroundMode));
  }, [backgroundMode]);

  /** 提交当前快照到历史（带抑制开关） */
  const commitHistory = useCallback(() => {
    if (suppressHistoryRef.current) return;
    history.commit({ nodes, edges });
  }, [history, nodes, edges]);

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

  // P4.2: 撤销（恢复历史快照）
  const handleUndo = useCallback(() => {
    const snapshot = history.undo();
    if (!snapshot) return;
    // 抑制历史写入
    suppressHistoryRef.current = true;
    setNodes(snapshot.nodes);
    setEdges(snapshot.edges);
    queueMicrotask(() => {
      suppressHistoryRef.current = false;
    });
    // 持久化到后端
    if (reactFlowInstance.current) {
      const flow: CanvasFlow = {
        nodes: snapshot.nodes.map(fromReactFlowNode),
        edges: snapshot.edges.map(fromReactFlowEdge),
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
  }, [history, sessionId]);

  // P4.2: 重做（恢复历史快照）
  const handleRedo = useCallback(() => {
    const snapshot = history.redo();
    if (!snapshot) return;
    suppressHistoryRef.current = true;
    setNodes(snapshot.nodes);
    setEdges(snapshot.edges);
    queueMicrotask(() => {
      suppressHistoryRef.current = false;
    });
    if (reactFlowInstance.current) {
      const flow: CanvasFlow = {
        nodes: snapshot.nodes.map(fromReactFlowNode),
        edges: snapshot.edges.map(fromReactFlowEdge),
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
  }, [history, sessionId]);

  // P4.2: 复制选中节点
  const handleCopy = useCallback(async () => {
    const selected = nodes
      .filter((n) => n.selected)
      .map((n) => n.id);
    if (selected.length === 0) return;
    await copyNodesToClipboard(nodes, edges, selected);
  }, [nodes, edges]);

  // P4.2: 粘贴（创建新节点/边，offset 位置避免重叠）
  const handlePaste = useCallback(async () => {
    const payload = await readClipboard();
    if (!payload || payload.nodes.length === 0) return;
    const OFFSET = 40;
    // 计算视口中心
    const inst0 = reactFlowInstance.current;
    let center = { x: 0, y: 0 };
    if (inst0) {
      const dom = document.querySelector(".react-flow") as HTMLElement | null;
      if (dom) {
        const rect = dom.getBoundingClientRect();
        center = inst0.screenToFlowPosition({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        });
      }
    }

    // 1) 顺序调用 createCanvasNode，获取服务端真实 ID
    const newNodes: Node[] = [];
    const oldToNewId = new Map<number, string>(); // payload index → 服务端 ID
    for (let i = 0; i < payload.nodes.length; i++) {
      const original = payload.nodes[i]!;
      const originalData = original.data as Record<string, unknown>;
      const position = {
        x: center.x + i * OFFSET * 4,
        y: center.y + i * OFFSET * 4,
      };
      try {
        const created = await createCanvasNode(sessionId, {
          type: original.type as CanvasNodeType,
          position,
          label:
            typeof originalData.label === "string"
              ? originalData.label
              : undefined,
        });
        oldToNewId.set(i, created.id);
        newNodes.push({
          id: created.id,
          type: original.type,
          position,
          data: originalData,
        });
        // 写入扩展字段（prompt/params/assetId）
        if (
          originalData.prompt ||
          originalData.params ||
          originalData.assetId
        ) {
          const params: Record<string, unknown> = {};
          if (originalData.prompt) params.prompt = originalData.prompt;
          if (originalData.params) params.params = originalData.params;
          if (originalData.assetId) params.assetId = originalData.assetId;
          await updateCanvasNode(sessionId, created.id, { params }).catch(
            () => {},
          );
        }
      } catch {
        // 单个失败不阻塞其他节点
      }
    }

    // 2) 创建边（用服务端真实 ID 重新连接）
    const newEdges: Edge[] = [];
    for (const e of payload.edges) {
      const sourceId = oldToNewId.get(e.sourceIndex);
      const targetId = oldToNewId.get(e.targetIndex);
      if (!sourceId || !targetId) continue;
      const edgeId = newCanvasEdgeId();
      const newEdge: Edge = {
        id: edgeId,
        source: sourceId,
        target: targetId,
        sourceHandle: e.sourceHandle ?? undefined,
        targetHandle: e.targetHandle ?? undefined,
        type: "smoothstep",
        animated: e.kind !== "reference",
        style: {
          stroke: e.kind === "reference" ? "#71717a" : "#6366f1",
          strokeWidth: 2,
          strokeDasharray: e.kind === "reference" ? "6 4" : undefined,
          opacity: e.kind === "reference" ? 0.7 : 1,
        },
        data: { kind: e.kind ?? "trigger" },
      };
      newEdges.push(newEdge);
      try {
        await createCanvasEdge(sessionId, {
          source: newEdge.source,
          target: newEdge.target,
          sourceHandle: newEdge.sourceHandle ?? undefined,
          targetHandle: newEdge.targetHandle ?? undefined,
        });
      } catch {
        // 忽略
      }
    }

    // 3) 抑制历史写入，一次性 commit
    suppressHistoryRef.current = true;
    setNodes((prev) => [...prev, ...newNodes]);
    setEdges((prev) => [...prev, ...newEdges]);
    queueMicrotask(() => {
      suppressHistoryRef.current = false;
    });

    // 4) 提交历史
    queueMicrotask(() => {
      const inst = reactFlowInstance.current;
      if (inst) {
        history.commit({ nodes: inst.getNodes(), edges: inst.getEdges() });
      } else {
        history.commit({ nodes: newNodes, edges: newEdges });
      }
    });
  }, [sessionId, history]);

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
      /** P4.2: 撤销 */
      undo: () => {
        handleUndo();
      },
      /** P4.2: 重做 */
      redo: () => {
        handleRedo();
      },
      /** P4.2: 复制选中节点 */
      copy: () => {
        void handleCopy();
      },
      /** P4.2: 粘贴 */
      paste: () => {
        void handlePaste();
      },
      /** P4.2: 订阅历史状态（overlay 撤销/重做按钮可用性） */
      subscribeHistory: (cb: (state: { canUndo: boolean; canRedo: boolean }) => void) => {
        return history.subscribe((s) => cb({ canUndo: s.canUndo, canRedo: s.canRedo }));
      },
      /** P4.3: 设置背景主题 */
      setBackgroundMode: (mode: "dots" | "lines" | "blank") => {
        setBackgroundMode(mode);
      },
      /** P4.3: 订阅背景主题 */
      subscribeBackground: (cb: (mode: "dots" | "lines" | "blank") => void) => {
        backgroundSubscribersRef.current.add(cb);
        cb(backgroundMode);
        return () => {
          backgroundSubscribersRef.current.delete(cb);
        };
      },
      /** P4.3: 获取当前背景主题 */
      getBackgroundMode: () => backgroundMode,
    }),
    [handleAutoLayout, notifyZoom, currentZoom, handleUndo, handleRedo, handleCopy, handlePaste, history, setBackgroundMode, backgroundMode],
  );

  // 加载画布流数据
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const flow = await fetchCanvasFlow(sessionId);
        if (cancelled) return;
        const loadedNodes = flow.nodes.map(toReactFlowNode);
        const loadedEdges = flow.edges.map(toReactFlowEdge);
        // 加载期间抑制历史写入
        suppressHistoryRef.current = true;
        setNodes(loadedNodes);
        setEdges(loadedEdges);
        // 重置历史栈：present = 加载后的快照
        history.reset({ nodes: loadedNodes, edges: loadedEdges });
        // 同步设置视口
        if (flow.viewport && reactFlowInstance.current) {
          reactFlowInstance.current.setViewport(flow.viewport);
          notifyZoom(flow.viewport.zoom);
        }
        // 记录初始版本号
        const version = await fetchCanvasFlowVersion(sessionId);
        if (!cancelled) lastRemoteVersionRef.current = version;
        // 释放抑制
        queueMicrotask(() => {
          suppressHistoryRef.current = false;
        });
      } catch {
        // 新画布：空数据即可
        suppressHistoryRef.current = true;
        history.reset({ nodes: [], edges: [] });
        queueMicrotask(() => {
          suppressHistoryRef.current = false;
        });
      }
      setLoaded(true);
    }
    void load();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

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
          const newNodes = flow.nodes.map(toReactFlowNode);
          const newEdges = flow.edges.map(toReactFlowEdge);
          // 抑制历史写入（远程拉取）
          suppressHistoryRef.current = true;
          setNodes(newNodes);
          setEdges(newEdges);
          history.reset({ nodes: newNodes, edges: newEdges });
          queueMicrotask(() => {
            suppressHistoryRef.current = false;
          });
        }
      } catch {
        // 忽略轮询错误
      }
    }, POLL_INTERVAL);
    return () => window.clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, loaded]);

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
        // P4.2: 拖拽完成提交历史
        queueMicrotask(() => {
          if (suppressHistoryRef.current) return;
          const inst = reactFlowInstance.current;
          if (inst) {
            history.commit({ nodes: inst.getNodes(), edges: inst.getEdges() });
          } else {
            commitHistory();
          }
        });
      }
      // 删除节点
      const removeChanges = changes.filter((c) => c.type === "remove");
      for (const rc of removeChanges) {
        if (rc.id) {
          void deleteCanvasNode(sessionId, rc.id).catch(() => {});
        }
      }
      // P4.2: 删除节点后提交历史
      if (removeChanges.length > 0) {
        queueMicrotask(() => {
          if (suppressHistoryRef.current) return;
          const inst = reactFlowInstance.current;
          if (inst) {
            history.commit({ nodes: inst.getNodes(), edges: inst.getEdges() });
          } else {
            commitHistory();
          }
        });
      }
    },
    [onNodesChange, sessionId, nodes, history, commitHistory],
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
      // P4.2: 删除边后提交历史
      if (removeChanges.length > 0) {
        queueMicrotask(() => {
          if (suppressHistoryRef.current) return;
          const inst = reactFlowInstance.current;
          if (inst) {
            history.commit({ nodes: inst.getNodes(), edges: inst.getEdges() });
          } else {
            commitHistory();
          }
        });
      }
    },
    [onEdgesChange, sessionId, history, commitHistory],
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

      // P4.2: 连线创建后提交历史
      queueMicrotask(() => {
        if (suppressHistoryRef.current) return;
        const inst = reactFlowInstance.current;
        if (inst) {
          history.commit({ nodes: inst.getNodes(), edges: inst.getEdges() });
        } else {
          history.commit({ nodes, edges: newEdge });
        }
      });
    },
    [nodes, edges, setEdges, sessionId, history],
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
      // P4.4: 点击空白处清除 related-node focus
      setFocusedNodeId(null);
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

  // P4.4: 选中变化时设置焦点节点（驱动 related-node 高亮）
  const handleSelectionChange = useCallback(
    ({ nodes: selected }: { nodes: Node[]; edges: Edge[] }) => {
      const selectedIds = selected
        .filter((n) => n.selected)
        .map((n) => n.id);
      if (selectedIds.length === 0) {
        setFocusedNodeId(null);
        return;
      }
      // 焦点节点：取最新选中的（最后一个）
      const focusId = selectedIds[selectedIds.length - 1] ?? null;
      setFocusedNodeId(focusId);
    },
    [],
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
        nodes={displayNodes}
        edges={displayEdges}
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
        /** P4.4: 选中变化时驱动 related-node focus */
        onSelectionChange={readOnly ? undefined : handleSelectionChange}
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
          /** P4.3: 背景主题（dots/lines/blank 可切换，持久化到 localStorage） */
          variant={
            backgroundMode === "dots"
              ? BackgroundVariant.Dots
              : backgroundMode === "lines"
                ? BackgroundVariant.Lines
                : BackgroundVariant.Cross
          }
          color="#1f1f3a"
          gap={24}
          size={1.2}
        />
        <Controls
          className="!border-white/10 !bg-[#0f0f0f] [&>button]:!border-white/10 [&>button]:!bg-[#0f0f0f] [&>button]:!fill-zinc-400"
        />
        <MiniMap
          className="!border-white/10 !bg-[#0f0f0f]"
          /** P4.3: 让 mini-map 可拖动跳转 + 滚轮缩放 */
          pannable
          zoomable
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
