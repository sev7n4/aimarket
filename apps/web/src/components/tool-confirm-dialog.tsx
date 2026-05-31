"use client";

import { useEffect, useMemo, useState } from "react";
import { GlassPanel, Button } from "@aimarket/ui";
import type { StudioTool } from "@/lib/types";
import type { CanvasItem } from "@/lib/canvas-tools";
import { assetUrl } from "@/lib/api-client";
import {
  TOOL_GRID_HINTS,
  TOOL_CONFIRM_STEPS,
  TOOL_PROMPT_PLACEHOLDERS,
  estimateToolPointsClient,
  toolConfirmPrimaryLabel,
  toolRefineSpecLine,
} from "@/lib/studio-tool-meta";
import { resolveToolResolution } from "@/lib/tool-resolution";

export interface ToolConfirmRequest {
  tool: StudioTool;
  item: CanvasItem;
  /** 变体默认 2 张 */
  defaultCount?: number;
}

export interface ToolConfirmOptions {
  count: number;
  prompt?: string;
  scale?: "2x" | "4x";
  intent?: "edit" | "replace";
}

interface ToolConfirmDialogProps {
  request: ToolConfirmRequest | null;
  onClose: () => void;
  onConfirm: (opts: ToolConfirmOptions) => void;
  pending?: boolean;
}

const VARIATION_COUNTS = [1, 2, 4] as const;
const UPSCALE_SCALES = ["2x", "4x"] as const;

const EXPAND_DIRECTIONS = [
  { id: "all", label: "四周", hint: "向四周自然扩展画面，保持主体清晰" },
  { id: "left", label: "向左", hint: "向左扩展画面，延伸背景" },
  { id: "right", label: "向右", hint: "向右扩展画面，延伸背景" },
  { id: "up", label: "向上", hint: "向上扩展天空或背景区域" },
  { id: "down", label: "向下", hint: "向下扩展地面或背景区域" },
] as const;

function OptionChip({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${
        active
          ? "border-orange-500/60 bg-orange-500/15 text-orange-200"
          : "border-white/10 text-zinc-400 hover:border-white/20 disabled:opacity-50"
      }`}
    >
      {children}
    </button>
  );
}

function ToolPreview({ item }: { item: CanvasItem }) {
  return (
    <div className="mt-3 flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.03] p-2">
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-zinc-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={assetUrl(item.url)}
          alt=""
          className="h-full w-full object-cover"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-zinc-300">当前选中图片</p>
        <p className="text-[11px] text-zinc-500">将作为本工具的输入源</p>
      </div>
    </div>
  );
}

function PointsFooter({
  tool,
  resolution,
  count,
}: {
  tool: StudioTool;
  resolution: string;
  count: number;
}) {
  const points = estimateToolPointsClient(tool, resolution, count);
  return (
    <p className="mt-3 text-[11px] text-zinc-500">
      {toolRefineSpecLine(tool, resolution, count)}预计消耗{" "}
      <span className="text-orange-300">{points}</span> 积分
    </p>
  );
}

export function ToolConfirmDialog({
  request,
  onClose,
  onConfirm,
  pending = false,
}: ToolConfirmDialogProps) {
  const [count, setCount] = useState(2);
  const [scale, setScale] = useState<"2x" | "4x">("2x");
  const [intent, setIntent] = useState<"edit" | "replace">("edit");
  const [prompt, setPrompt] = useState("");
  const [expandDirection, setExpandDirection] = useState<string | null>(null);

  useEffect(() => {
    if (!request) return;
    setCount(request.defaultCount ?? 2);
    setScale("2x");
    setIntent("edit");
    setPrompt("");
    setExpandDirection(null);
  }, [request?.tool.id, request?.item.id]);

  const resolved = useMemo(() => {
    if (!request) return null;
    const { tool, item } = request;
    const resolution = resolveToolResolution(tool.id);
    const effectiveCount = tool.id === "variation" ? count : 1;
    const hint = TOOL_GRID_HINTS[tool.id];
    const step = TOOL_CONFIRM_STEPS[tool.id];
    const placeholder = TOOL_PROMPT_PLACEHOLDERS[tool.id];
    return {
      tool,
      item,
      resolution,
      effectiveCount,
      hint,
      step,
      placeholder,
    };
  }, [request, count]);

  if (!request || !resolved) return null;

  const { tool, item, resolution, effectiveCount, hint, step, placeholder } =
    resolved;

  const expandHint = expandDirection
    ? EXPAND_DIRECTIONS.find((d) => d.id === expandDirection)?.hint
    : null;
  const resolvedPrompt =
    tool.id === "expand"
      ? [expandHint, prompt.trim()].filter(Boolean).join("，") ||
        tool.defaultPrompt
      : prompt.trim();

  const confirmDisabled =
    pending ||
    (tool.id === "text" && !resolvedPrompt) ||
    (tool.id === "inpaint" && !resolvedPrompt);

  function handleConfirm() {
    onConfirm({
      count: effectiveCount,
      prompt: resolvedPrompt || undefined,
      scale: tool.id === "upscale" ? scale : undefined,
      intent: tool.id === "focus-edit" ? intent : undefined,
    });
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tool-confirm-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <GlassPanel className="w-full max-w-sm p-4">
        <h2
          id="tool-confirm-title"
          className="text-sm font-medium text-zinc-100"
        >
          精修 · {tool.name}
        </h2>
        <p className="mt-1 text-xs text-zinc-400">
          {tool.description ||
            "基于当前选中图片执行工具链，不使用左侧生成面板的模型与数量设置。"}
        </p>
        {step ? (
          <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
            {step}
          </p>
        ) : null}
        {hint ? (
          <p className="mt-1 text-[11px] text-zinc-600">{hint}</p>
        ) : null}

        <ToolPreview item={item} />

        {tool.id === "variation" ? (
          <div className="mt-3">
            <p className="mb-1.5 text-[11px] text-zinc-500">生成张数</p>
            <div className="flex gap-2">
              {VARIATION_COUNTS.map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={pending}
                  onClick={() => setCount(n)}
                  className={`flex-1 rounded-lg border py-1.5 text-xs transition ${
                    count === n
                      ? "border-orange-500/60 bg-orange-500/15 text-orange-200"
                      : "border-white/10 text-zinc-400 hover:border-white/20"
                  }`}
                >
                  {n} 张
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {tool.id === "upscale" ? (
          <div className="mt-3">
            <p className="mb-1.5 text-[11px] text-zinc-500">放大倍数</p>
            <div className="flex gap-2">
              {UPSCALE_SCALES.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={pending}
                  onClick={() => setScale(s)}
                  className={`flex-1 rounded-lg border py-1.5 text-xs transition ${
                    scale === s
                      ? "border-orange-500/60 bg-orange-500/15 text-orange-200"
                      : "border-white/10 text-zinc-400 hover:border-white/20"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] text-zinc-600">
              4× 适合印刷级细节，耗时略长
            </p>
          </div>
        ) : null}

        {tool.id === "cutout" ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-200">
              透明底 PNG
            </span>
            <span className="rounded-md border border-white/10 px-2 py-0.5 text-[10px] text-zinc-500">
              4K 输出
            </span>
          </div>
        ) : null}

        {tool.id === "enhance" ? (
          <div className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] text-zinc-500">
            适合预览稿、截图或轻度模糊图；不会大幅改变构图与色彩风格。
          </div>
        ) : null}

        {tool.id === "expand" ? (
          <div className="mt-3 space-y-2">
            <p className="text-[11px] text-zinc-500">扩展方向</p>
            <div className="flex flex-wrap gap-1.5">
              {EXPAND_DIRECTIONS.map((d) => (
                <OptionChip
                  key={d.id}
                  active={expandDirection === d.id}
                  disabled={pending}
                  onClick={() =>
                    setExpandDirection((prev) =>
                      prev === d.id ? null : d.id,
                    )
                  }
                >
                  {d.label}
                </OptionChip>
              ))}
            </div>
            <textarea
              value={prompt}
              disabled={pending}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={placeholder}
              rows={2}
              className="w-full resize-none rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-orange-500/40 focus:outline-none"
            />
          </div>
        ) : null}

        {tool.id === "erase" || tool.id === "inpaint" ? (
          <div className="mt-3 space-y-2">
            <div className="rounded-lg border border-dashed border-orange-500/25 bg-orange-500/[0.06] px-3 py-2 text-[11px] text-orange-200/90">
              下一步：在画布上用画笔圈选
              {tool.id === "erase" ? "要消除" : "要重绘"}的区域
            </div>
            <textarea
              value={prompt}
              disabled={pending}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={placeholder}
              rows={tool.id === "inpaint" ? 2 : 1}
              className="w-full resize-none rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-orange-500/40 focus:outline-none"
            />
            {tool.id === "inpaint" ? (
              <p className="text-[10px] text-zinc-600">
                请描述圈选区域要改成什么
              </p>
            ) : null}
          </div>
        ) : null}

        {tool.id === "focus-edit" ? (
          <div className="mt-3 space-y-2">
            <p className="text-[11px] text-zinc-500">编辑意图</p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => setIntent("edit")}
                className={`flex-1 rounded-lg border py-1.5 text-xs transition ${
                  intent === "edit"
                    ? "border-orange-500/60 bg-orange-500/15 text-orange-200"
                    : "border-white/10 text-zinc-400 hover:border-white/20"
                }`}
              >
                局部修改
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setIntent("replace")}
                className={`flex-1 rounded-lg border py-1.5 text-xs transition ${
                  intent === "replace"
                    ? "border-orange-500/60 bg-orange-500/15 text-orange-200"
                    : "border-white/10 text-zinc-400 hover:border-white/20"
                }`}
              >
                对象替换
              </button>
            </div>
            <textarea
              value={prompt}
              disabled={pending}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={placeholder}
              rows={2}
              className="w-full resize-none rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-orange-500/40 focus:outline-none"
            />
            <p className="text-[10px] text-zinc-600">
              可先写好 prompt，点选目标后在工作台微调提交
            </p>
          </div>
        ) : null}

        {tool.id === "text" ? (
          <div className="mt-3">
            <p className="mb-1.5 text-[11px] text-zinc-500">新文字内容</p>
            <textarea
              value={prompt}
              disabled={pending}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={placeholder}
              rows={2}
              className="w-full resize-none rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-orange-500/40 focus:outline-none"
            />
          </div>
        ) : null}

        {tool.id === "blend" ? (
          <div className="mt-3 space-y-2">
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] text-zinc-500">
              需要至少两张参考图：当前图会自动 @
              到工作台，请再 @ 另一张素材后提交。
            </div>
            <textarea
              value={prompt}
              disabled={pending}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={placeholder}
              rows={2}
              className="w-full resize-none rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-orange-500/40 focus:outline-none"
            />
          </div>
        ) : null}

        <PointsFooter
          tool={tool}
          resolution={resolution}
          count={effectiveCount}
        />

        <div className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={onClose}
          >
            取消
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={confirmDisabled}
            onClick={handleConfirm}
          >
            {pending ? "执行中…" : toolConfirmPrimaryLabel(tool.id)}
          </Button>
        </div>
      </GlassPanel>
    </div>
  );
}
