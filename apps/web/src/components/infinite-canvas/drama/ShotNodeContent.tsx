import React, { useState, type ReactNode } from "react";
import { Clapperboard, Clock, Grid3x3 } from "lucide-react";

import type { CanvasNodeData } from "../types";
import { canvasTheme } from "../canvas-theme";
import { MultiCamGrid } from "./MultiCamGrid";
function Badge({ children, color }: { children: ReactNode; color: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium"
      style={{ background: `${color}22`, color }}
    >
      {children}
    </span>
  );
}

const shotStatusColors: Record<string, string> = {
  pending: "#78716c",
  keyframe: "#3b82f6",
  video: "#f97316",
  audio: "#a855f7",
  done: "#22c55e",
  failed: "#ef4444",
};

const shotStatusLabels: Record<string, string> = {
  pending: "待处理",
  keyframe: "关键帧",
  video: "视频中",
  audio: "音频中",
  done: "已完成",
  failed: "失败",
};

type ShotNodeContentProps = {
  node: CanvasNodeData;
};

export function ShotNodeContent({ node }: ShotNodeContentProps) {
  const m = node.metadata;
  const shotOrder = m?.shotOrder;
  const shotStatus = m?.shotStatus;
  const dialogue = m?.dialogue;
  const shotSize = m?.cameraShotSize;
  const movement = m?.cameraMovement;
  const lighting = m?.cameraLighting;
  const durationSec = m?.durationSec;
  const visualPrompt = m?.visualPrompt;
  const keyframeVariantUrls = m?.keyframeVariantUrls || [];

  const keyframeSrc = m?.content || (m?.keyframeOutputId ? `/outputs/${m.keyframeOutputId}` : null);
  const hasKeyframe = Boolean(keyframeSrc);
  const hasVariants = keyframeVariantUrls.length > 0;
  const [showGrid, setShowGrid] = useState(false);

  const cameraParts = [shotSize, movement, lighting].filter(Boolean);
  const cameraLine = cameraParts.length > 0 ? cameraParts.join(" · ") : null;

  // Build variants array: primary keyframe + variant URLs
  const variants = [
    ...(keyframeSrc ? [{ id: m!.keyframeOutputId || "primary", url: keyframeSrc!, label: "主图" }] : []),
    ...keyframeVariantUrls.map((url, i) => ({
      id: `variant-${i}`,
      url,
      label: `变体 ${i + 1}`,
    })),
  ];

  return (
    <div className="flex h-full w-full flex-col gap-1.5 p-3">
      {/* Keyframe thumbnail area */}
      {hasVariants && showGrid ? (
        /* Multi-cam grid view */
        <div className="relative w-full overflow-hidden rounded-lg" style={{ background: canvasTheme.node.panel }}>
          <MultiCamGrid
            variants={variants}
            gridSize={variants.length > 9 ? 5 : 3}
            heroIndex={m?.keyframeHeroIndex}
            className="p-1.5"
          />
          {/* Grid toggle — return to single view */}
          <button
            type="button"
            onClick={() => setShowGrid(false)}
            className="absolute right-1.5 top-1.5 z-10 flex size-6 items-center justify-center rounded-md bg-black/60 text-white transition hover:bg-black/80"
            title="单图视图"
          >
            <Clapperboard className="size-3.5" />
          </button>
          {/* Badges */}
          {shotOrder != null && (
            <div className="absolute left-1.5 top-1.5 z-10">
              <Badge color="#6366f1">#{shotOrder}</Badge>
            </div>
          )}
        </div>
      ) : hasKeyframe ? (
        <div className="relative aspect-video w-full overflow-hidden rounded-lg" style={{ background: canvasTheme.node.panel }}>
          <img
            src={keyframeSrc!}
            alt={`分镜 #${shotOrder ?? "?"}`}
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            className="pointer-events-none size-full select-none object-cover"
          />
          {/* Grid toggle — switch to multi-cam view */}
          {hasVariants && (
            <button
              type="button"
              onClick={() => setShowGrid(true)}
              className="absolute bottom-1.5 right-1.5 flex size-6 items-center justify-center rounded-md bg-black/60 text-white transition hover:bg-black/80"
              title="多机位视图"
            >
              <Grid3x3 className="size-3.5" />
            </button>
          )}
          {/* Shot order badge — top-left */}
          {shotOrder != null && (
            <div className="absolute left-1.5 top-1.5">
              <Badge color="#6366f1">#{shotOrder}</Badge>
            </div>
          )}
          {/* Shot status badge — top-right */}
          {shotStatus && (
            <div className="absolute right-1.5 top-1.5">
              <Badge color={shotStatusColors[shotStatus] || "#78716c"}>
                {shotStatusLabels[shotStatus] || shotStatus}
              </Badge>
            </div>
          )}
        </div>
      ) : (
        <div
          className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg"
          style={{ background: canvasTheme.node.panel }}
        >
          <Clapperboard className="size-8 opacity-20" style={{ color: canvasTheme.node.faint }} />
          {shotOrder != null && (
            <div className="absolute left-1.5 top-1.5">
              <Badge color="#6366f1">#{shotOrder}</Badge>
            </div>
          )}
          {shotStatus && (
            <div className="absolute right-1.5 top-1.5">
              <Badge color={shotStatusColors[shotStatus] || "#78716c"}>
                {shotStatusLabels[shotStatus] || shotStatus}
              </Badge>
            </div>
          )}
        </div>
      )}

      {/* Dialogue preview */}
      {dialogue && (
        <div
          className="line-clamp-1 italic text-xs leading-snug"
          style={{ color: canvasTheme.node.muted }}
        >
          &ldquo;{dialogue}&rdquo;
        </div>
      )}

      {/* Camera spec line */}
      {cameraLine && (
        <div
          className="text-[11px] leading-snug"
          style={{ color: canvasTheme.node.faint }}
        >
          {cameraLine}
        </div>
      )}

      {/* Visual prompt fallback (when no keyframe) */}
      {!hasKeyframe && visualPrompt && (
        <div
          className="line-clamp-3 text-[11px] leading-relaxed"
          style={{ color: canvasTheme.node.faint }}
        >
          {visualPrompt}
        </div>
      )}

      {/* Duration badge */}
      {durationSec != null && (
        <div className="flex items-center gap-1">
          <Clock className="size-3" style={{ color: canvasTheme.node.faint }} />
          <Badge color="#0ea5e9">{durationSec}s</Badge>
        </div>
      )}
    </div>
  );
}
