"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Bookmark,
  ChevronRight,
  Loader2,
  Play,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { canvasTheme } from "./canvas-theme";
import { cn } from "@aimarket/ui";
import type { CanvasNodeData, CanvasConnection } from "./types";
import type { CanvasAgentOp } from "./utils";
import {
  deleteDramaTemplate,
  listDramaTemplates,
  runDramaTemplate,
  saveDramaTemplate,
  type DramaTemplateCategory,
  type DramaTemplateItem,
} from "@/lib/api-client";
import {
  deleteWorkflowTemplate,
  listWorkflowTemplates,
  saveWorkflowTemplate,
  type WorkflowTemplateItem,
} from "@/lib/api/workflow-templates";
import {
  serializeWorkflowSelection,
  workflowTemplateToOps,
} from "@/lib/workflow-template-apply";

// ── Serialization helpers ──

type SerializedNodeTemplate = {
  type: string;
  title: string;
  /** 相对位置（首个节点归零），便于复用 */
  relX: number;
  relY: number;
  width: number;
  height: number;
  metadata?: Record<string, unknown>;
};

type SerializedConnectionTemplate = {
  fromNodeIndex: number;
  toNodeIndex: number;
};

type DramaTemplatePayload = {
  userIdea: string;
  projectType: "short_drama" | "mv" | "creative";
  targetDurationSec?: number;
  aspectRatio?: "9:16" | "16:9";
  nodeTemplate: {
    nodes: SerializedNodeTemplate[];
    connections: SerializedConnectionTemplate[];
  };
};

/** 将选中节点组序列化为模板 payload（节点 id 替换为索引） */
function serializeSelection(
  nodes: CanvasNodeData[],
  connections: CanvasConnection[],
  meta: {
    userIdea: string;
    projectType: DramaTemplateCategory;
    targetDurationSec?: number;
    aspectRatio?: "9:16" | "16:9";
  },
): DramaTemplatePayload {
  if (nodes.length === 0) {
    throw new Error("请先在画布上选中节点");
  }
  const minX = Math.min(...nodes.map((n) => n.position.x));
  const minY = Math.min(...nodes.map((n) => n.position.y));
  const indexById = new Map<string, number>();
  nodes.forEach((n, i) => indexById.set(n.id, i));

  const serializedNodes: SerializedNodeTemplate[] = nodes.map((n) => ({
    type: n.type,
    title: n.title,
    relX: Math.round(n.position.x - minX),
    relY: Math.round(n.position.y - minY),
    width: n.width,
    height: n.height,
    metadata: n.metadata as Record<string, unknown> | undefined,
  }));

  const serializedConnections: SerializedConnectionTemplate[] = connections
    .filter(
      (c) => indexById.has(c.fromNodeId) && indexById.has(c.toNodeId),
    )
    .map((c) => ({
      fromNodeIndex: indexById.get(c.fromNodeId)!,
      toNodeIndex: indexById.get(c.toNodeId)!,
    }));

  return {
    userIdea: meta.userIdea,
    projectType:
      meta.projectType === "tvc" || meta.projectType === "custom"
        ? "creative"
        : meta.projectType,
    targetDurationSec: meta.targetDurationSec,
    aspectRatio: meta.aspectRatio,
    nodeTemplate: {
      nodes: serializedNodes,
      connections: serializedConnections,
    },
  };
}

// ── UI helpers ──

const categoryLabels: Record<DramaTemplateCategory, string> = {
  short_drama: "短剧",
  mv: "MV",
  tvc: "TVC",
  custom: "自建",
};

const categoryColors: Record<DramaTemplateCategory, string> = {
  short_drama: "#8b5cf6",
  mv: "#0ea5e9",
  tvc: "#f97316",
  custom: "#78716c",
};

function Badge({
  children,
  color,
}: {
  children: React.ReactNode;
  color: string;
}) {
  return (
    <span
      className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium"
      style={{ background: `${color}22`, color }}
    >
      {children}
    </span>
  );
}

// ── Main component ──

type TemplateManagerProps = {
  /** 当前选中的画布节点（用于"保存为模板"） */
  selectedNodes: CanvasNodeData[];
  /** 当前画布连线（仅保留选中节点之间的连线） */
  connections: CanvasConnection[];
  /** 当前会话 ID（用于"一键重跑" / 应用模板） */
  sessionId?: string;
  /** drama | workflow 模板模式 */
  variant?: "drama" | "workflow";
  /** 重跑已启动回调（plan run id + 模板 payload，用于布局还原） */
  onRunStarted?: (planRunId: string, template: Record<string, unknown>) => void;
  /** workflow 模式：将模板反序列化为画布 Op */
  onApplyTemplate?: (ops: CanvasAgentOp[]) => void;
  onClose?: () => void;
  initialCollapsed?: boolean;
};

type PanelTab = "library" | "save";

export function TemplateManager({
  selectedNodes,
  connections,
  sessionId,
  variant = "drama",
  onRunStarted,
  onApplyTemplate,
  onClose,
  initialCollapsed = false,
}: TemplateManagerProps) {
  const isWorkflow = variant === "workflow";
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [tab, setTab] = useState<PanelTab>("library");
  const [templates, setTemplates] = useState<DramaTemplateItem[]>([]);
  const [workflowTemplates, setWorkflowTemplates] = useState<WorkflowTemplateItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Save form state
  const [name, setName] = useState("");
  const [category, setCategory] =
    useState<DramaTemplateCategory>("custom");
  const [description, setDescription] = useState("");
  const [userIdea, setUserIdea] = useState("");
  const [targetDurationSec, setTargetDurationSec] = useState<string>("90");
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9">("9:16");
  const [saving, setSaving] = useState(false);

  // Run dialog state
  const [runDialogId, setRunDialogId] = useState<string | null>(null);
  const [runIdeaOverride, setRunIdeaOverride] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isWorkflow) {
        setWorkflowTemplates(await listWorkflowTemplates());
      } else {
        setTemplates(await listDramaTemplates());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载模板失败");
    } finally {
      setLoading(false);
    }
  }, [isWorkflow]);

  useEffect(() => {
    if (!collapsed) void refresh();
  }, [collapsed, refresh]);

  const handleSave = useCallback(async () => {
    setError(null);
    if (!name.trim()) {
      setError("请输入模板名称");
      return;
    }
    if (selectedNodes.length === 0) {
      setError("请先在画布上选中节点");
      return;
    }
    if (selectedNodes.length === 0) {
      setError("请先在画布上选中节点");
      return;
    }
    if (!isWorkflow && userIdea.trim().length < 10) {
      setError("创意描述至少 10 个字符");
      return;
    }
    setSaving(true);
    try {
      if (isWorkflow) {
        const payload = serializeWorkflowSelection(selectedNodes, connections);
        await saveWorkflowTemplate({
          name: name.trim(),
          description: description.trim() || undefined,
          template: payload,
        });
      } else {
        const payload = serializeSelection(selectedNodes, connections, {
          userIdea: userIdea.trim(),
          projectType: category,
          targetDurationSec: targetDurationSec
            ? Number(targetDurationSec)
            : undefined,
          aspectRatio,
        });
        await saveDramaTemplate({
          name: name.trim(),
          category,
          description: description.trim() || undefined,
          template: payload as unknown as Record<string, unknown>,
        });
      }
      setName("");
      setDescription("");
      setUserIdea("");
      setTab("library");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存模板失败");
    } finally {
      setSaving(false);
    }
  }, [
    name,
    selectedNodes,
    connections,
    userIdea,
    category,
    targetDurationSec,
    aspectRatio,
    description,
    refresh,
    isWorkflow,
  ]);

  const handleApplyWorkflow = useCallback(
    (templateId: string) => {
      if (!sessionId || !onApplyTemplate) {
        setError("缺少会话或应用回调");
        return;
      }
      const tpl = workflowTemplates.find((t) => t.id === templateId);
      if (!tpl) return;
      onApplyTemplate(workflowTemplateToOps(tpl.template, sessionId));
      setError(null);
    },
    [sessionId, onApplyTemplate, workflowTemplates],
  );

  const handleRun = useCallback(
    async (templateId: string) => {
      if (!sessionId) {
        setError("缺少会话 ID，无法重跑");
        return;
      }
      setRunningId(templateId);
      setError(null);
      try {
        const tpl = templates.find((t) => t.id === templateId);
        const planRun = await runDramaTemplate(templateId, {
          sessionId,
          autoProduce: false,
          userIdeaOverride:
            runIdeaOverride.trim().length >= 10
              ? runIdeaOverride.trim()
              : undefined,
        });
        setRunDialogId(null);
        setRunIdeaOverride("");
        onRunStarted?.(planRun.id, tpl?.template ?? {});
      } catch (err) {
        setError(err instanceof Error ? err.message : "重跑失败");
      } finally {
        setRunningId(null);
      }
    },
    [sessionId, runIdeaOverride, onRunStarted, templates],
  );

  const handleDelete = useCallback(
    async (templateId: string) => {
      if (!confirm("确认删除该模板？")) return;
      try {
        if (isWorkflow) {
          await deleteWorkflowTemplate(templateId);
        } else {
          await deleteDramaTemplate(templateId);
        }
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "删除失败");
      }
    },
    [refresh, isWorkflow],
  );

  if (collapsed) {
    return (
      <div
        className="flex w-10 shrink-0 flex-col items-center gap-2 border-l py-3"
        style={{
          background: canvasTheme.canvas.background,
          borderColor: canvasTheme.node.stroke,
        }}
      >
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="rounded p-1 transition hover:bg-white/10"
          aria-label="展开模板管理"
          title="工作流模板"
        >
          <Bookmark
            className="size-4"
            style={{ color: canvasTheme.node.muted }}
          />
        </button>
        <span
          className="text-[10px]"
          style={{ color: canvasTheme.node.faint, writingMode: "vertical-rl" }}
        >
          模板
        </span>
      </div>
    );
  }

  return (
    <div
      className="flex h-full w-[320px] shrink-0 flex-col border-l"
      style={{
        background: canvasTheme.canvas.background,
        borderColor: canvasTheme.node.stroke,
      }}
      data-testid="template-manager-panel"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: canvasTheme.node.stroke }}
      >
        <div className="flex items-center gap-2">
          <Bookmark
            className="size-3.5"
            style={{ color: canvasTheme.node.muted }}
          />
          <span
            className="text-xs font-semibold"
            style={{ color: canvasTheme.node.text }}
          >
            工作流模板
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="rounded p-0.5 transition hover:bg-white/10"
            aria-label="收起面板"
            title="收起"
          >
            <ChevronRight
              className="size-3.5"
              style={{ color: canvasTheme.node.faint }}
            />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded p-0.5 transition hover:bg-white/10"
              aria-label="关闭面板"
            >
              <X
                className="size-3.5"
                style={{ color: canvasTheme.node.faint }}
              />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div
        className="flex border-b"
        style={{ borderColor: canvasTheme.node.stroke }}
      >
        {(["library", "save"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 px-3 py-2 text-[11px] font-medium transition",
              tab === t ? "border-b-2" : "opacity-60 hover:opacity-100",
            )}
            style={{
              color: canvasTheme.node.text,
              borderColor: tab === t ? canvasTheme.node.activeStroke : "transparent",
            }}
          >
            {t === "library" ? "模板库" : "保存模板"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {error && (
          <div
            className="mb-3 rounded-md border px-2.5 py-1.5 text-[11px]"
            style={{
              borderColor: "rgba(239,68,68,0.4)",
              background: "rgba(239,68,68,0.1)",
              color: "#fca5a5",
            }}
          >
            {error}
          </div>
        )}

        {tab === "library" ? (
          <div className="flex flex-col gap-2">
            {loading && (isWorkflow ? workflowTemplates.length === 0 : templates.length === 0) ? (
              <div className="flex items-center justify-center py-8">
                <Loader2
                  className="size-4 animate-spin"
                  style={{ color: canvasTheme.node.faint }}
                />
              </div>
            ) : isWorkflow ? (
              workflowTemplates.length === 0 ? (
                <p
                  className="py-8 text-center text-[11px]"
                  style={{ color: canvasTheme.node.faint }}
                >
                  暂无工作流模板
                </p>
              ) : (
                workflowTemplates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="flex flex-col gap-1.5 rounded-lg border p-2.5"
                    style={{
                      borderColor: canvasTheme.node.stroke,
                      background: canvasTheme.node.fill,
                    }}
                  >
                    <span
                      className="truncate text-xs font-semibold"
                      style={{ color: canvasTheme.node.text }}
                    >
                      {tpl.name}
                    </span>
                    {tpl.description ? (
                      <p
                        className="line-clamp-2 text-[11px]"
                        style={{ color: canvasTheme.node.muted }}
                      >
                        {tpl.description}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      disabled={!sessionId}
                      onClick={() => handleApplyWorkflow(tpl.id)}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium"
                      style={{
                        background: canvasTheme.toolbar.activeBg,
                        color: canvasTheme.toolbar.activeText,
                      }}
                      data-testid={`workflow-template-apply-${tpl.id}`}
                    >
                      <Play className="size-3" />
                      使用模板
                    </button>
                    {!tpl.isPreset ? (
                      <button
                        type="button"
                        onClick={() => void handleDelete(tpl.id)}
                        className="inline-flex items-center gap-1 self-start rounded-md px-1.5 py-1 text-[11px]"
                        style={{ color: canvasTheme.node.faint }}
                      >
                        <Trash2 className="size-3" />
                        删除
                      </button>
                    ) : null}
                  </div>
                ))
              )
            ) : templates.length === 0 ? (
              <p
                className="py-8 text-center text-[11px]"
                style={{ color: canvasTheme.node.faint }}
              >
                暂无模板
              </p>
            ) : (
              templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="flex flex-col gap-1.5 rounded-lg border p-2.5"
                  style={{
                    borderColor: canvasTheme.node.stroke,
                    background: canvasTheme.node.fill,
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span
                        className="truncate text-xs font-semibold"
                        style={{ color: canvasTheme.node.text }}
                      >
                        {tpl.name}
                      </span>
                      {tpl.isPreset && (
                        <Badge color="#22c55e">预置</Badge>
                      )}
                    </div>
                    <Badge color={categoryColors[tpl.category]}>
                      {categoryLabels[tpl.category]}
                    </Badge>
                  </div>
                  {tpl.description && (
                    <p
                      className="line-clamp-2 text-[11px] leading-relaxed"
                      style={{ color: canvasTheme.node.muted }}
                    >
                      {tpl.description}
                    </p>
                  )}
                  <div className="mt-1 flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={!sessionId || runningId === tpl.id}
                      onClick={() => {
                        setRunDialogId(
                          runDialogId === tpl.id ? null : tpl.id,
                        );
                        setRunIdeaOverride("");
                      }}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition disabled:opacity-50"
                      style={{
                        background: canvasTheme.toolbar.activeBg,
                        color: canvasTheme.toolbar.activeText,
                      }}
                    >
                      <Play className="size-3" />
                      {runDialogId === tpl.id ? "取消" : "重跑"}
                    </button>
                    {!tpl.isPreset && (
                      <button
                        type="button"
                        onClick={() => handleDelete(tpl.id)}
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] transition hover:bg-white/10"
                        style={{ color: canvasTheme.node.faint }}
                        aria-label="删除模板"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    )}
                    {runningId === tpl.id && (
                      <Loader2
                        className="size-3 animate-spin"
                        style={{ color: canvasTheme.node.faint }}
                      />
                    )}
                  </div>
                  {runDialogId === tpl.id && (
                    <div
                      className="mt-1.5 flex flex-col gap-1.5 rounded-md border p-2"
                      style={{
                        borderColor: canvasTheme.node.stroke,
                        background: canvasTheme.node.panel,
                      }}
                    >
                      <label
                        className="text-[10px] font-medium"
                        style={{ color: canvasTheme.node.faint }}
                      >
                        替换创意（可选，留空使用模板默认）
                      </label>
                      <textarea
                        value={runIdeaOverride}
                        onChange={(e) => setRunIdeaOverride(e.target.value)}
                        placeholder="至少 10 个字符的新创意..."
                        rows={3}
                        className="w-full resize-none rounded border bg-transparent px-2 py-1 text-[11px] outline-none focus:ring-1"
                        style={{
                          borderColor: canvasTheme.node.stroke,
                          color: canvasTheme.node.text,
                        }}
                      />
                      <button
                        type="button"
                        disabled={runningId === tpl.id}
                        onClick={() => handleRun(tpl.id)}
                        className="inline-flex items-center justify-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition disabled:opacity-50"
                        style={{
                          background: "#22c55e",
                          color: "#052e16",
                        }}
                      >
                        <Play className="size-3" />
                        确认重跑
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label
                className="text-[11px] font-medium"
                style={{ color: canvasTheme.node.faint }}
              >
                模板名称
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={isWorkflow ? "例如：文生图+图生视频" : "例如：我的短剧模板"}
                className="w-full rounded border bg-transparent px-2 py-1.5 text-xs outline-none focus:ring-1"
                style={{
                  borderColor: canvasTheme.node.stroke,
                  color: canvasTheme.node.text,
                }}
              />
            </div>

            {!isWorkflow ? (
            <>
            <div className="flex flex-col gap-1">
              <label
                className="text-[11px] font-medium"
                style={{ color: canvasTheme.node.faint }}
              >
                分类
              </label>
              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as DramaTemplateCategory)
                }
                className="w-full rounded border bg-transparent px-2 py-1.5 text-xs outline-none focus:ring-1"
                style={{
                  borderColor: canvasTheme.node.stroke,
                  color: canvasTheme.node.text,
                }}
              >
                <option value="short_drama">短剧</option>
                <option value="mv">MV</option>
                <option value="tvc">广告 TVC</option>
                <option value="custom">自定义</option>
              </select>
            </div>
            </>
            ) : null}

            <div className="flex flex-col gap-1">
              <label
                className="text-[11px] font-medium"
                style={{ color: canvasTheme.node.faint }}
              >
                描述（可选）
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="模板用途说明..."
                rows={2}
                className="w-full resize-none rounded border bg-transparent px-2 py-1.5 text-xs outline-none focus:ring-1"
                style={{
                  borderColor: canvasTheme.node.stroke,
                  color: canvasTheme.node.text,
                }}
              />
            </div>

            {!isWorkflow ? (
            <>
            <div className="flex flex-col gap-1">
              <label
                className="text-[11px] font-medium"
                style={{ color: canvasTheme.node.faint }}
              >
                创意描述（重跑时使用）
              </label>
              <textarea
                value={userIdea}
                onChange={(e) => setUserIdea(e.target.value)}
                placeholder="至少 10 个字符..."
                rows={3}
                className="w-full resize-none rounded border bg-transparent px-2 py-1.5 text-xs outline-none focus:ring-1"
                style={{
                  borderColor: canvasTheme.node.stroke,
                  color: canvasTheme.node.text,
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label
                  className="text-[11px] font-medium"
                  style={{ color: canvasTheme.node.faint }}
                >
                  时长（秒）
                </label>
                <input
                  value={targetDurationSec}
                  onChange={(e) => setTargetDurationSec(e.target.value)}
                  type="number"
                  min={30}
                  max={300}
                  className="w-full rounded border bg-transparent px-2 py-1.5 text-xs outline-none focus:ring-1"
                  style={{
                    borderColor: canvasTheme.node.stroke,
                    color: canvasTheme.node.text,
                  }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label
                  className="text-[11px] font-medium"
                  style={{ color: canvasTheme.node.faint }}
                >
                  宽高比
                </label>
                <select
                  value={aspectRatio}
                  onChange={(e) =>
                    setAspectRatio(e.target.value as "9:16" | "16:9")
                  }
                  className="w-full rounded border bg-transparent px-2 py-1.5 text-xs outline-none focus:ring-1"
                  style={{
                    borderColor: canvasTheme.node.stroke,
                    color: canvasTheme.node.text,
                  }}
                >
                  <option value="9:16">9:16 竖屏</option>
                  <option value="16:9">16:9 横屏</option>
                </select>
              </div>
            </div>
            </>
            ) : null}

            <div
              className="rounded-md border px-2.5 py-1.5 text-[10px]"
              style={{
                borderColor: canvasTheme.node.stroke,
                background: canvasTheme.node.fill,
                color: canvasTheme.node.muted,
              }}
            >
              已选中 <strong>{selectedNodes.length}</strong> 个节点，
              {connections.length} 条连线将被序列化进模板。
            </div>

            <button
              type="button"
              disabled={saving || selectedNodes.length === 0}
              onClick={handleSave}
              className="inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition disabled:opacity-50"
              style={{
                background: canvasTheme.toolbar.activeBg,
                color: canvasTheme.toolbar.activeText,
              }}
            >
              {saving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Plus className="size-3.5" />
              )}
              保存为模板
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
