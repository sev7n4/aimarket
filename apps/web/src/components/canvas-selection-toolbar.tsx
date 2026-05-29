"use client";

import {
  ArrowUpToLine,
  AtSign,
  Brush,
  Crop,
  Crosshair,
  Eraser,
  Layers,
  Loader2,
  Maximize2,
  Scissors,
  Sparkles,
  Type,
  type LucideIcon,
} from "lucide-react";
import type { CanvasItem } from "@/lib/canvas-tools";
import type { StudioTool } from "@/lib/types";

const TOOL_ICONS: Record<string, LucideIcon> = {
  expand: Maximize2,
  erase: Eraser,
  cutout: Scissors,
  inpaint: Brush,
  "focus-edit": Crosshair,
  text: Type,
  upscale: ArrowUpToLine,
  enhance: Sparkles,
  blend: Layers,
  crop: Crop,
};

const TOOL_SHORT: Record<string, string> = {
  expand: "扩图",
  erase: "消除",
  cutout: "抠图",
  inpaint: "局改",
  "focus-edit": "焦点",
  text: "改字",
  upscale: "超清",
  enhance: "变清",
  blend: "融合",
  crop: "裁剪",
};

interface CanvasSelectionToolbarProps {
  tools: StudioTool[];
  selectedItem: CanvasItem | null;
  readOnly?: boolean;
  /** 当前进行中的工具 id（按钮显示 spinner） */
  pendingToolId?: string | null;
  layout: "vertical" | "horizontal";
  onRunTool: (tool: StudioTool, item: CanvasItem) => void;
  /** 把当前选中图片 @ 到工作台输入框，作为本次生成/修图上下文 */
  onMentionItem?: (item: CanvasItem) => void;
}

/**
 * 选中画布图片后浮出的 AI 工具栏：
 * - PC：画布右上角竖排，hover 显示工具名
 * - 移动：画布上方一行横向滚动 chip（图标+短名）
 *
 * 工具列表来自 fetchTools()，去掉 clientOnly（如 crop，由画布原生工具栏承担）。
 * 点击后的执行策略由 StudioWorkspace 统一决定：
 * - 一键类：二次确认后运行
 * - 画笔/提示词类：@ 到工作台，等待用户补充指令再提交
 */
export function CanvasSelectionToolbar({
  tools,
  selectedItem,
  readOnly = false,
  pendingToolId = null,
  layout,
  onRunTool,
  onMentionItem,
}: CanvasSelectionToolbarProps) {
  if (!selectedItem || readOnly) return null;
  const hasSource = Boolean(selectedItem.outputId || selectedItem.assetId);
  if (!hasSource) return null;

  const visibleTools = tools.filter((t) => !t.clientOnly);

  if (visibleTools.length === 0 && !onMentionItem) return null;

  if (layout === "vertical") {
    return (
      <div className="pointer-events-auto absolute right-3 top-3 z-20 flex max-h-[calc(100%-1.5rem)] w-[112px] flex-col gap-1 overflow-y-auto rounded-2xl border border-white/10 bg-[#0d0d0d]/95 p-1.5 shadow-2xl backdrop-blur scrollbar-none">
        {visibleTools.length > 0 ? (
          <div className="flex items-center gap-1 px-1.5 pb-1 pt-0.5 text-[10px] font-medium text-zinc-500">
            <span className="text-sm leading-none" aria-hidden>
              🎩
            </span>
            <span className="uppercase tracking-wider">工具</span>
          </div>
        ) : null}
        {onMentionItem ? (
          <button
            type="button"
            title="@ 到工作台"
            onClick={() => onMentionItem(selectedItem)}
            className="group flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs text-zinc-300 transition hover:bg-white/10 hover:text-white"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-purple-300 group-hover:bg-purple-500/15">
              <AtSign className="size-4" strokeWidth={1.6} />
            </span>
            <span className="whitespace-nowrap pr-1 text-[11px] leading-tight">
              引用
            </span>
          </button>
        ) : null}
        {visibleTools.map((tool) => {
          const Icon = TOOL_ICONS[tool.id] ?? Sparkles;
          const isPending = pendingToolId === tool.id;
          const requireMissing =
            tool.requiresSource && !selectedItem.outputId && !selectedItem.assetId;
          return (
            <button
              key={tool.id}
              type="button"
              title={tool.description}
              disabled={isPending || requireMissing}
              onClick={() => onRunTool(tool, selectedItem)}
              className="group flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs text-zinc-300 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-orange-300 group-hover:bg-orange-500/15">
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Icon className="size-4" strokeWidth={1.6} />
                )}
              </span>
              <span className="whitespace-nowrap pr-1 text-[11px] leading-tight">
                {tool.name}
              </span>
            </button>
          );
        })}

      </div>
    );
  }

  return (
    <div className="pointer-events-auto absolute left-2 right-2 top-2 z-20">
      <div className="flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-white/10 bg-[#0d0d0d]/95 px-2 py-1.5 shadow-xl backdrop-blur scrollbar-none">
        <span className="flex shrink-0 items-center pl-1 pr-1 text-base leading-none" aria-label="工具">
          🎩
        </span>
        {onMentionItem ? (
          <button
            type="button"
            title="@ 到工作台"
            onClick={() => onMentionItem(selectedItem)}
            className="group flex shrink-0 items-center gap-1.5 rounded-full border border-purple-400/20 bg-purple-500/10 px-2.5 py-1.5 text-[11px] text-purple-100 transition hover:border-purple-300/50 hover:bg-purple-500/20"
          >
            <AtSign className="size-3.5 text-purple-300" strokeWidth={1.6} />
            <span className="whitespace-nowrap">引用</span>
          </button>
        ) : null}
        {visibleTools.map((tool) => {
          const Icon = TOOL_ICONS[tool.id] ?? Sparkles;
          const short = TOOL_SHORT[tool.id] ?? tool.name;
          const isPending = pendingToolId === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              title={tool.description}
              disabled={isPending}
              onClick={() => onRunTool(tool, selectedItem)}
              className="group flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-zinc-200 transition hover:border-orange-400/40 hover:bg-orange-500/15 hover:text-orange-100 disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="size-3.5 animate-spin text-orange-300" />
              ) : (
                <Icon className="size-3.5 text-orange-300" strokeWidth={1.6} />
              )}
              <span className="whitespace-nowrap">{short}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
