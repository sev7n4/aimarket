/**
 * 画布撤销/重做历史栈
 * 用于 P4.2 Undo/Redo：
 * - 仅跟踪用户离散操作（拖拽完成、连线、删除、粘贴、自动布局）产生的快照
 * - 连续的拖拽过程不计入历史（避免 history 污染）
 * - 每次 commit 清空 redo 栈（线性时间流）
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Edge, Node } from "@xyflow/react";

/** 历史快照：节点+边的不可变快照 */
export interface CanvasSnapshot {
  nodes: Node[];
  edges: Edge[];
}

/** 历史栈状态 */
export interface CanvasHistoryState {
  /** 可撤销（past 不为空） */
  canUndo: boolean;
  /** 可重做（future 不为空） */
  canRedo: boolean;
  /** 历史深度（仅 past） */
  pastDepth: number;
}

const MAX_HISTORY_DEPTH = 50;

/** 深比较两个快照是否相等（避免无变化时污染历史） */
function snapshotEqual(a: CanvasSnapshot, b: CanvasSnapshot): boolean {
  if (a.nodes.length !== b.nodes.length || a.edges.length !== b.edges.length) {
    return false;
  }
  // 节点 ID + 位置比较
  for (let i = 0; i < a.nodes.length; i++) {
    const an = a.nodes[i];
    const bn = b.nodes[i];
    if (!an || !bn || an.id !== bn.id) return false;
    if (an.position.x !== bn.position.x || an.position.y !== bn.position.y) {
      return false;
    }
  }
  // 边 ID + 源目标比较
  for (let i = 0; i < a.edges.length; i++) {
    const ae = a.edges[i];
    const be = b.edges[i];
    if (!ae || !be || ae.id !== be.id) return false;
    if (ae.source !== be.source || ae.target !== be.target) return false;
  }
  return true;
}

export interface UseCanvasHistoryOptions {
  /** 初始化时的快照（一般是当前 nodes/edges） */
  initial: CanvasSnapshot;
}

export interface UseCanvasHistoryResult {
  /** 提交新快照到历史（自动去重相邻相等快照） */
  commit: (snapshot: CanvasSnapshot) => void;
  /** 撤销：返回被回退到的快照，没有可撤销时返回 null */
  undo: () => CanvasSnapshot | null;
  /** 重做：返回前进到的快照，没有可重做时返回 null */
  redo: () => CanvasSnapshot | null;
  /** 订阅状态变化（用于 overlay 显示撤销/重做按钮） */
  subscribe: (cb: (state: CanvasHistoryState) => void) => () => void;
  /** 当前历史状态 */
  state: CanvasHistoryState;
  /** 重置历史（节点全部清空时调用） */
  reset: (snapshot: CanvasSnapshot) => void;
}

/**
 * 画布历史栈 hook
 * 用 ref 存储栈以避免 history 自身触发 re-render
 * 通过 subscribe 模式向订阅者推送状态变化
 */
export function useCanvasHistory({
  initial,
}: UseCanvasHistoryOptions): UseCanvasHistoryResult {
  // 栈：past 是已回退的快照，present 是当前快照，future 是已撤销但可重做的快照
  const pastRef = useRef<CanvasSnapshot[]>([]);
  const presentRef = useRef<CanvasSnapshot>(initial);
  const futureRef = useRef<CanvasSnapshot[]>([]);
  const subscribersRef = useRef<Set<(s: CanvasHistoryState) => void>>(new Set());
  const [state, setState] = useState<CanvasHistoryState>({
    canUndo: false,
    canRedo: false,
    pastDepth: 0,
  });

  /** 同步状态到所有订阅者 + React state */
  const notify = useCallback(() => {
    const next: CanvasHistoryState = {
      canUndo: pastRef.current.length > 0,
      canRedo: futureRef.current.length > 0,
      pastDepth: pastRef.current.length,
    };
    setState(next);
    subscribersRef.current.forEach((cb) => cb(next));
  }, []);

  /** 提交新快照到历史栈 */
  const commit = useCallback(
    (snapshot: CanvasSnapshot) => {
      // 与当前 present 相等则跳过（避免无变化污染）
      if (snapshotEqual(presentRef.current, snapshot)) return;
      // 推入 past
      pastRef.current.push(presentRef.current);
      // 超过最大深度则丢弃最早的
      if (pastRef.current.length > MAX_HISTORY_DEPTH) {
        pastRef.current.shift();
      }
      // 新操作清空 future
      futureRef.current = [];
      // 设置新的 present
      presentRef.current = snapshot;
      notify();
    },
    [notify],
  );

  /** 撤销 */
  const undo = useCallback((): CanvasSnapshot | null => {
    if (pastRef.current.length === 0) return null;
    const prev = pastRef.current.pop()!;
    // 当前 present 推入 future
    futureRef.current.push(presentRef.current);
    // 限制 future 深度
    if (futureRef.current.length > MAX_HISTORY_DEPTH) {
      futureRef.current.shift();
    }
    presentRef.current = prev;
    notify();
    return prev;
  }, [notify]);

  /** 重做 */
  const redo = useCallback((): CanvasSnapshot | null => {
    if (futureRef.current.length === 0) return null;
    const next = futureRef.current.pop()!;
    // 当前 present 推入 past
    pastRef.current.push(presentRef.current);
    if (pastRef.current.length > MAX_HISTORY_DEPTH) {
      pastRef.current.shift();
    }
    presentRef.current = next;
    notify();
    return next;
  }, [notify]);

  /** 重置（节点全部清空时使用） */
  const reset = useCallback(
    (snapshot: CanvasSnapshot) => {
      pastRef.current = [];
      futureRef.current = [];
      presentRef.current = snapshot;
      notify();
    },
    [notify],
  );

  /** 订阅 */
  const subscribe = useCallback(
    (cb: (s: CanvasHistoryState) => void) => {
      subscribersRef.current.add(cb);
      // 立即推送当前状态
      cb({
        canUndo: pastRef.current.length > 0,
        canRedo: futureRef.current.length > 0,
        pastDepth: pastRef.current.length,
      });
      return () => {
        subscribersRef.current.delete(cb);
      };
    },
    [],
  );

  // 初始化时同步一次
  useEffect(() => {
    notify();
  }, [notify]);

  return { commit, undo, redo, subscribe, state, reset };
}
