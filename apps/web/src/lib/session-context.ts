"use client";

import { useState, useCallback } from "react";
import type { CreationLane, VideoReferenceMode } from "./creation-dock-prefs";
import type { CanvasMaskSelection } from "./canvas-tools";
import type { FocusPointChip, FocusEditIntent } from "./focus-edit";

// ─── 类型定义 ───────────────────────────────────────────────

/** 跨车道共享的创作上下文 */
export interface SessionContext {
  /** 当前会话 ID */
  sessionId: string;

  /** 最后活跃的车道 */
  lastActiveLane: CreationLane;

  /** 最后活跃时间戳 */
  lastActiveAt: number;

  /** 画布选中项 ID（跨车道共享） */
  selectedItemId: string | null;

  /** 当前 mask 选择（跨车道共享） */
  maskSelection: CanvasMaskSelection | null;

  /** 焦点编辑会话（跨车道共享） */
  focusEditSession: {
    points: FocusPointChip[];
    intent: FocusEditIntent;
    cropSize: number;
  } | null;

  /** 最近使用的工具 ID 历史（最多保留 10 条） */
  recentToolIds: string[];

  /** 视频参考模式偏好 */
  preferredVideoReferenceMode: VideoReferenceMode | null;

  /** 上一次图片编辑的结果（用于视频首帧引用） */
  lastEditResult: {
    outputId: string;
    url: string;
    toolId: string;
  } | null;

  /** 参考图资产列表（跨车道共享） */
  referenceAssetIds: string[];
}

// ─── 上下文工厂与更新 ───────────────────────────────────────

/** 创建空的 SessionContext */
export function createEmptySessionContext(sessionId: string): SessionContext {
  return {
    sessionId,
    lastActiveLane: "agent",
    lastActiveAt: Date.now(),
    selectedItemId: null,
    maskSelection: null,
    focusEditSession: null,
    recentToolIds: [],
    preferredVideoReferenceMode: null,
    lastEditResult: null,
    referenceAssetIds: [],
  };
}

/** 更新 SessionContext（浅合并） */
export function updateSessionContext(
  prev: SessionContext,
  patch: Partial<SessionContext>,
): SessionContext {
  return { ...prev, ...patch, lastActiveAt: Date.now() };
}

/** 记录工具使用历史（去重，保留最近 10 条） */
export function recordToolUsage(
  prev: SessionContext,
  toolId: string,
): SessionContext {
  const filtered = prev.recentToolIds.filter((id) => id !== toolId);
  return {
    ...prev,
    recentToolIds: [toolId, ...filtered].slice(0, 10),
    lastActiveAt: Date.now(),
  };
}

/** 记录编辑结果（供视频车道引用） */
export function recordEditResult(
  prev: SessionContext,
  result: { outputId: string; url: string; toolId: string },
): SessionContext {
  return {
    ...prev,
    lastEditResult: result,
    lastActiveAt: Date.now(),
  };
}

/** 清除所有共享状态（保留 sessionId 和 lastActiveLane） */
export function clearSharedState(prev: SessionContext): SessionContext {
  return {
    sessionId: prev.sessionId,
    lastActiveLane: prev.lastActiveLane,
    lastActiveAt: Date.now(),
    selectedItemId: null,
    maskSelection: null,
    focusEditSession: null,
    recentToolIds: [],
    preferredVideoReferenceMode: null,
    lastEditResult: null,
    referenceAssetIds: [],
  };
}

// ─── 上下文推断 ─────────────────────────────────────────────

/** 根据当前 SessionContext 推断视频参考模式 */
export function inferVideoReferenceMode(
  ctx: SessionContext,
): VideoReferenceMode {
  // 有 mask + 有参考图 → 首尾帧模式
  if (ctx.maskSelection && ctx.referenceAssetIds.length > 0) {
    return "first-last";
  }
  // 有编辑结果 → 首尾帧模式（使用编辑结果作首帧）
  if (ctx.lastEditResult) {
    return "first-last";
  }
  // 参考图 >= 3 张 → 智能多帧模式
  if (ctx.referenceAssetIds.length >= 3) {
    return "smart-multi-frame";
  }
  // 默认 → 全能模式
  return "omni";
}

/** 根据当前 SessionContext 推断推荐工具 */
export function inferRecommendedTool(
  ctx: SessionContext,
): string | null {
  // 最近使用过的工具优先
  if (ctx.recentToolIds.length > 0) {
    return ctx.recentToolIds[0];
  }
  // 焦点编辑会话存在 → 推荐焦点编辑
  if (ctx.focusEditSession) {
    return "focus-edit";
  }
  // mask 选择存在 → 推荐 inpaint
  if (ctx.maskSelection) {
    return "inpaint";
  }
  return null;
}

/** 判断视频生成是否应使用图片编辑结果作为首帧 */
export function shouldUseEditResultAsFirstFrame(
  ctx: SessionContext,
  currentLane: CreationLane = "video",
): boolean {
  return (
    ctx.lastEditResult !== null &&
    ctx.lastActiveLane === "image" &&
    currentLane === "video"
  );
}

// ─── React Hook ─────────────────────────────────────────────

/** Session Context React Hook */
export function useSessionContext(sessionId: string): {
  context: SessionContext;
  update: (patch: Partial<SessionContext>) => void;
  recordTool: (toolId: string) => void;
  recordEdit: (result: { outputId: string; url: string; toolId: string }) => void;
  clear: () => void;
} {
  const [context, setContext] = useState<SessionContext>(() =>
    createEmptySessionContext(sessionId),
  );

  const update = useCallback((patch: Partial<SessionContext>) => {
    setContext((prev) => updateSessionContext(prev, patch));
  }, []);

  const recordTool = useCallback((toolId: string) => {
    setContext((prev) => recordToolUsage(prev, toolId));
  }, []);

  const recordEdit = useCallback(
    (result: { outputId: string; url: string; toolId: string }) => {
      setContext((prev) => recordEditResult(prev, result));
    },
    [],
  );

  const clear = useCallback(() => {
    setContext((prev) => clearSharedState(prev));
  }, []);

  return { context, update, recordTool, recordEdit, clear };
}
