"use client";

/**
 * 12.4 前端模板加载 UI
 * 模板列表（卡片网格）+ 预览 + 一键使用
 */
import { useState, useEffect, useCallback } from "react";
import { LayoutTemplate, Trash2, Play, X, ChevronRight } from "lucide-react";
import {
  type CanvasTemplate,
  deserializeTemplate,
} from "@/lib/canvas-template";
import type { CanvasFlowNode, CanvasFlowEdge } from "@/lib/canvas-node-types";
import {
  fetchCanvasTemplates,
  deleteCanvasTemplate,
  saveCanvasFlow,
  fetchCanvasFlow,
} from "@/lib/api-client";
import { NODE_TYPE_LABELS } from "@/lib/canvas-node-types";

interface CanvasTemplateGalleryProps {
  /** 当前会话 ID */
  sessionId: string;
  /** 使用模板回调（返回反序列化后的节点和边） */
  onUseTemplate?: (nodes: CanvasFlowNode[], edges: CanvasFlowEdge[]) => void;
  /** 关闭回调 */
  onClose?: () => void;
}

export function CanvasTemplateGallery({
  sessionId,
  onUseTemplate,
  onClose,
}: CanvasTemplateGalleryProps) {
  const [templates, setTemplates] = useState<CanvasTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  // 加载模板列表
  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCanvasTemplates(sessionId);
      setTemplates(data);
    } catch {
      // 静默处理
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  // 当前选中的模板
  const selected = templates.find((t) => t.id === selectedId);

  // 使用模板：反序列化 → 合并到当前画布
  const handleUseTemplate = async () => {
    if (!selected) return;
    setApplying(true);

    try {
      const { nodes: newNodes, edges: newEdges } =
        deserializeTemplate(selected);

      // 获取当前画布流
      const flow = await fetchCanvasFlow(sessionId);

      // 合并节点和边（追加到现有画布）
      const mergedNodes = [...flow.nodes, ...newNodes];
      const mergedEdges = [...flow.edges, ...newEdges];

      // 保存合并后的画布流
      await saveCanvasFlow(sessionId, {
        nodes: mergedNodes,
        edges: mergedEdges,
        viewport: flow.viewport,
      });

      onUseTemplate?.(newNodes, newEdges);
    } catch {
      // 静默处理
    } finally {
      setApplying(false);
    }
  };

  // 删除模板
  const handleDelete = async (templateId: string) => {
    try {
      await deleteCanvasTemplate(sessionId, templateId);
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
      if (selectedId === templateId) setSelectedId(null);
    } catch {
      // 静默处理
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/95 shadow-2xl backdrop-blur-sm">
      {/* 标题行 */}
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-medium text-zinc-200">
          <LayoutTemplate className="size-4 text-amber-400" />
          模板库
        </h3>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-600 transition hover:text-zinc-400"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="flex min-h-[300px]">
        {/* 左侧：模板列表 */}
        <div className="w-1/2 border-r border-white/5 p-3">
          {loading ? (
            <div className="py-8 text-center text-xs text-zinc-600">
              加载中...
            </div>
          ) : templates.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-600">
              暂无模板
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {templates.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={`group flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 transition ${
                    selectedId === t.id
                      ? "bg-amber-500/10 text-amber-200"
                      : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{t.name}</p>
                    <p className="mt-0.5 truncate text-[10px] text-zinc-600">
                      {t.nodes.length} 节点 · {t.edges.length} 边
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDelete(t.id);
                      }}
                      className="rounded p-1 text-zinc-600 transition hover:text-red-400"
                    >
                      <Trash2 className="size-3" />
                    </button>
                    <ChevronRight className="size-3" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 右侧：模板预览 */}
        <div className="w-1/2 p-3">
          {selected ? (
            <div className="flex h-full flex-col">
              {/* 模板信息 */}
              <h4 className="mb-1 text-sm font-medium text-zinc-200">
                {selected.name}
              </h4>
              {selected.description && (
                <p className="mb-3 text-xs text-zinc-500">
                  {selected.description}
                </p>
              )}

              {/* 节点预览列表 */}
              <div className="mb-3 flex-1 overflow-y-auto">
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                  节点结构
                </p>
                <div className="flex flex-col gap-1">
                  {selected.nodes.map((n, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-md bg-white/5 px-2 py-1.5"
                    >
                      <span className="flex size-5 items-center justify-center rounded-full bg-white/10 text-[9px] text-zinc-400">
                        {i}
                      </span>
                      <span className="text-xs text-zinc-300">
                        {NODE_TYPE_LABELS[n.type]}
                      </span>
                      <span className="truncate text-[10px] text-zinc-600">
                        {n.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 使用模板按钮 */}
              <button
                type="button"
                disabled={applying}
                onClick={() => void handleUseTemplate()}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 transition hover:border-amber-500/50 hover:bg-amber-500/20 disabled:opacity-50"
              >
                <Play className="size-3" />
                {applying ? "应用中..." : "使用模板"}
              </button>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-zinc-600">
              选择模板预览
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
