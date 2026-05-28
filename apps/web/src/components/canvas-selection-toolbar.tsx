"use client";

import {
  ArrowUpToLine,
  Brush,
  Crop,
  Eraser,
  Layers,
  Loader2,
  Maximize2,
  Scissors,
  Sparkles,
  Type,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import type { CanvasItem, CanvasItemRole } from "@/lib/canvas-tools";
import { CANVAS_ROLE_LABELS } from "@/lib/canvas-roles";
import type { StudioTool } from "@/lib/types";

const TOOL_ICONS: Record<string, LucideIcon> = {
  expand: Maximize2,
  erase: Eraser,
  cutout: Scissors,
  inpaint: Brush,
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
  /** 角色变更回调（用于把上传图标记为「商品/参考」） */
  onAssignRole?: (itemId: string, role: CanvasItemRole) => void;
}

/**
 * 选中画布图片后浮出的 AI 工具栏：
 * - PC：画布右上角竖排，hover 显示工具名
 * - 移动：画布上方一行横向滚动 chip（图标+短名）
 *
 * 工具列表来自 fetchTools()，去掉 clientOnly（如 crop，由画布原生工具栏承担）。
 * 点击直接以选中图为参考一键运行，不需要"先选工具再点运行"两步。
 */
export function CanvasSelectionToolbar({
  tools,
  selectedItem,
  readOnly = false,
  pendingToolId = null,
  layout,
  onRunTool,
  onAssignRole,
}: CanvasSelectionToolbarProps) {
  if (!selectedItem || readOnly) return null;
  const hasSource = Boolean(selectedItem.outputId || selectedItem.assetId);
  if (!hasSource) return null;

  const visibleTools = tools.filter((t) => !t.clientOnly);
  /**
   * 角色按钮仅对「上传/导入素材」开放：生成态产物（output）的角色由系统自动维护。
   * 对应原 CanvasRoleActions 的 `item.source === "generation"` 时不显示的逻辑。
   */
  const showRoleButtons =
    Boolean(onAssignRole) && selectedItem.source !== "generation";

  if (visibleTools.length === 0 && !showRoleButtons) return null;

  if (layout === "vertical") {
    return (
      <div className="pointer-events-auto absolute right-3 top-3 z-20 flex max-h-[calc(100%-1.5rem)] w-[112px] flex-col gap-1 overflow-y-auto rounded-2xl border border-white/10 bg-[#0d0d0d]/95 p-1.5 shadow-2xl backdrop-blur scrollbar-none">
        {visibleTools.length > 0 ? (
          <div className="flex items-center gap-1 px-1.5 pb-1 pt-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            <Wand2 className="size-3" strokeWidth={1.6} />
            AI 工具
          </div>
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

        {showRoleButtons ? (
          <div className="mt-1 border-t border-white/10 pt-1.5">
            <div className="px-1.5 pb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              画布素材
            </div>
            <div className="flex flex-col gap-1">
              <RoleButton
                active={selectedItem.role === "product"}
                label={CANVAS_ROLE_LABELS.product}
                onClick={() => onAssignRole?.(selectedItem.id, "product")}
                color="orange"
              />
              <RoleButton
                active={selectedItem.role === "reference"}
                label={CANVAS_ROLE_LABELS.reference}
                onClick={() => onAssignRole?.(selectedItem.id, "reference")}
                color="violet"
              />
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="pointer-events-auto absolute left-2 right-2 top-2 z-20">
      <div className="flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-white/10 bg-[#0d0d0d]/95 px-2 py-1.5 shadow-xl backdrop-blur scrollbar-none">
        <span className="flex shrink-0 items-center gap-1 pl-1 pr-1 text-[10px] font-medium text-zinc-500">
          <Wand2 className="size-3" strokeWidth={1.6} />
          AI
        </span>
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
        {showRoleButtons ? (
          <>
            <span className="mx-1 h-4 w-px shrink-0 bg-white/10" aria-hidden />
            <RoleButton
              active={selectedItem.role === "product"}
              label="商品"
              onClick={() => onAssignRole?.(selectedItem.id, "product")}
              color="orange"
              compact
            />
            <RoleButton
              active={selectedItem.role === "reference"}
              label="参考"
              onClick={() => onAssignRole?.(selectedItem.id, "reference")}
              color="violet"
              compact
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

function RoleButton({
  active,
  label,
  onClick,
  color,
  compact = false,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  color: "orange" | "violet";
  compact?: boolean;
}) {
  const activeCls =
    color === "orange"
      ? "bg-orange-500 text-black"
      : "bg-violet-500 text-white";
  const inactiveCls =
    color === "orange"
      ? "border border-white/10 text-zinc-300 hover:border-orange-400/40"
      : "border border-white/10 text-zinc-300 hover:border-violet-400/40";
  const padCls = compact ? "px-2.5 py-1 text-[11px]" : "px-2 py-1.5 text-[11px]";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full transition ${padCls} ${
        active ? activeCls : inactiveCls
      }`}
    >
      {label}
    </button>
  );
}
