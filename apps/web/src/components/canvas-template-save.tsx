"use client";

/**
 * 12.3 前端模板保存 UI
 * 选中节点组后弹出"保存为模板"面板
 */
import { useState } from "react";
import { Save, X } from "lucide-react";
import type { CanvasFlowNode, CanvasFlowEdge } from "@/lib/canvas-node-types";
import {
  serializeToTemplate,
  type CanvasTemplate,
} from "@/lib/canvas-template";
import { saveCanvasTemplate } from "@/lib/api-client";

interface CanvasTemplateSaveProps {
  /** 当前画布中选中的节点 */
  selectedNodes: CanvasFlowNode[];
  /** 与选中节点相关的边 */
  selectedEdges: CanvasFlowEdge[];
  /** 当前会话 ID */
  sessionId: string;
  /** 保存成功回调 */
  onSave?: (template: CanvasTemplate) => void;
  /** 取消/关闭回调 */
  onCancel?: () => void;
}

export function CanvasTemplateSave({
  selectedNodes,
  selectedEdges,
  sessionId,
  onSave,
  onCancel,
}: CanvasTemplateSaveProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("请输入模板名称");
      return;
    }
    if (selectedNodes.length === 0) {
      setError("请先选中节点");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const template = serializeToTemplate(
        selectedNodes,
        selectedEdges,
        name.trim(),
        description.trim() || undefined,
      );
      await saveCanvasTemplate(sessionId, template);
      onSave?.(template);
    } catch (e) {
      setError((e as Error).message ?? "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/95 p-4 shadow-2xl backdrop-blur-sm">
      {/* 标题行 */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium text-zinc-200">
          <Save className="size-4 text-amber-400" />
          保存为模板
        </h3>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-zinc-600 transition hover:text-zinc-400"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* 选中节点数 */}
      <p className="mb-3 text-xs text-zinc-500">
        已选 {selectedNodes.length} 个节点，{selectedEdges.length} 条边
      </p>

      {/* 模板名称 */}
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="模板名称"
        maxLength={100}
        className="mb-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-white/20 focus:outline-none"
      />

      {/* 模板描述 */}
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="模板描述（可选）"
        maxLength={500}
        rows={2}
        className="mb-3 w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-white/20 focus:outline-none"
      />

      {/* 错误信息 */}
      {error && (
        <p className="mb-2 text-xs text-red-400">{error}</p>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={saving || !name.trim()}
          onClick={handleSave}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 transition hover:border-amber-500/50 hover:bg-amber-500/20 disabled:opacity-50"
        >
          <Save className="size-3" />
          {saving ? "保存中..." : "保存模板"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-500 transition hover:border-white/20 hover:text-zinc-300"
          >
            取消
          </button>
        )}
      </div>
    </div>
  );
}
