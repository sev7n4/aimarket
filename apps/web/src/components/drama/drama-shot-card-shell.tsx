"use client";

import { useState, type ReactNode } from "react";
import { Clapperboard, Clock, Grid3x3, GripVertical } from "lucide-react";

import { DramaAssetCardShell } from "@/components/drama/drama-asset-card-shell";
import { DramaBadge } from "@/components/drama/drama-badge";
import { canvasTheme } from "@/components/infinite-canvas/canvas-theme";
import type { CanvasNodeData } from "@/components/infinite-canvas/types";
import {
  shotDialogueLine,
  shotThumbnailUrl,
} from "@/lib/drama-shot-helpers";
import type { DramaStoryboardShot } from "@/lib/types";
import { MultiCamGrid } from "@/components/multi-cam-grid";

const SHOT_STATUS_COLORS: Record<string, string> = {
  pending: "#78716c",
  keyframe: "#3b82f6",
  video: "#f97316",
  audio: "#a855f7",
  done: "#22c55e",
  failed: "#ef4444",
};

const SHOT_STATUS_LABELS: Record<string, string> = {
  pending: "待处理",
  keyframe: "关键帧",
  video: "视频中",
  audio: "音频中",
  done: "已完成",
  failed: "失败",
};

export type DramaShotCardDisplay = {
  shotOrder?: number;
  shotStatus?: string;
  dialogue?: string;
  shotSize?: string;
  movement?: string;
  lighting?: string;
  durationSec?: number;
  visualPrompt?: string;
  keyframeSrc?: string | null;
  keyframeOutputId?: string;
  keyframeVariantUrls?: string[];
  keyframeHeroIndex?: number;
  /** panel timeline：镜号标签 S1 */
  stripLabel?: string;
  /** panel timeline：摘要（对白或画面描述） */
  stripSummary?: string;
};

export type DramaShotCardShellProps = {
  mode: "panel" | "node";
  /** panel 时间线条带（无 DramaAssetCardShell 外框） */
  layout?: "default" | "timeline";
  shot: DramaShotCardDisplay;
  testId?: string;
  className?: string;
  footer?: ReactNode;
  children?: ReactNode;
  /** timeline 条带左上角拖拽把手等 */
  timelineLeading?: ReactNode;
};

export function dramaShotDisplayFromNode(
  node: CanvasNodeData,
): DramaShotCardDisplay {
  const m = node.metadata;
  const keyframeSrc =
    m?.content ||
    (m?.keyframeOutputId ? `/outputs/${m.keyframeOutputId}` : null);
  return {
    shotOrder: m?.shotOrder,
    shotStatus: m?.shotStatus,
    dialogue: m?.dialogue,
    shotSize: m?.cameraShotSize,
    movement: m?.cameraMovement,
    lighting: m?.cameraLighting,
    durationSec: m?.durationSec,
    visualPrompt: m?.visualPrompt,
    keyframeSrc,
    keyframeOutputId: m?.keyframeOutputId,
    keyframeVariantUrls: m?.keyframeVariantUrls,
    keyframeHeroIndex: m?.keyframeHeroIndex,
  };
}

export function dramaShotDisplayFromShot(
  shot: DramaStoryboardShot,
): DramaShotCardDisplay {
  const dialogue = shotDialogueLine(shot);
  const thumb = shotThumbnailUrl(shot);
  return {
    shotOrder: shot.order,
    shotStatus: shot.status,
    dialogue: dialogue || undefined,
    shotSize: shot.cameraSpec.shotSize,
    movement: shot.cameraSpec.movement,
    lighting: shot.cameraSpec.lighting,
    durationSec: shot.durationSec,
    visualPrompt: shot.visualPrompt,
    keyframeSrc: thumb ?? null,
    keyframeOutputId: shot.keyframeOutputId,
    keyframeVariantUrls: shot.keyframeVariantUrls,
    keyframeHeroIndex: shot.keyframeHeroIndex,
    stripLabel: `S${shot.order + 1}`,
    stripSummary: dialogue ? `「${dialogue}」` : shot.visualPrompt,
  };
}

function shotHeroOverlayBadges(shot: DramaShotCardDisplay): ReactNode {
  return (
    <>
      {shot.shotOrder != null ? (
        <div className="absolute left-1.5 top-1.5 z-10">
          <DramaBadge color="#6366f1">#{shot.shotOrder}</DramaBadge>
        </div>
      ) : null}
      {shot.shotStatus ? (
        <div className="absolute right-1.5 top-1.5 z-10">
          <DramaBadge color={SHOT_STATUS_COLORS[shot.shotStatus] || "#78716c"}>
            {SHOT_STATUS_LABELS[shot.shotStatus] || shot.shotStatus}
          </DramaBadge>
        </div>
      ) : null}
    </>
  );
}

function ShotNodeHero({ shot }: { shot: DramaShotCardDisplay }) {
  const keyframeVariantUrls = shot.keyframeVariantUrls || [];
  const hasKeyframe = Boolean(shot.keyframeSrc);
  const hasVariants = keyframeVariantUrls.length > 0;
  const [showGrid, setShowGrid] = useState(false);

  const variants = [
    ...(shot.keyframeSrc
      ? [
          {
            id: shot.keyframeOutputId || "primary",
            url: shot.keyframeSrc,
            label: "主图",
          },
        ]
      : []),
    ...keyframeVariantUrls.map((url, i) => ({
      id: `variant-${i}`,
      url,
      label: `变体 ${i + 1}`,
    })),
  ];

  if (hasVariants && showGrid) {
    return (
      <>
        <MultiCamGrid
          variant="canvas"
          variants={variants}
          gridSize={variants.length > 9 ? 5 : 3}
          heroIndex={shot.keyframeHeroIndex}
          className="size-full p-1.5"
        />
        <button
          type="button"
          onClick={() => setShowGrid(false)}
          className="absolute right-1.5 top-1.5 z-20 flex size-6 items-center justify-center rounded-md bg-black/60 text-white transition hover:bg-black/80"
          title="单图视图"
        >
          <Clapperboard className="size-3.5" />
        </button>
        {shotHeroOverlayBadges(shot)}
      </>
    );
  }

  if (hasKeyframe) {
    return (
      <>
        <img
          src={shot.keyframeSrc!}
          alt={`分镜 #${shot.shotOrder ?? "?"}`}
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          className="pointer-events-none size-full select-none object-cover"
        />
        {hasVariants ? (
          <button
            type="button"
            onClick={() => setShowGrid(true)}
            className="absolute bottom-1.5 right-1.5 z-20 flex size-6 items-center justify-center rounded-md bg-black/60 text-white transition hover:bg-black/80"
            title="多机位视图"
          >
            <Grid3x3 className="size-3.5" />
          </button>
        ) : null}
        {shotHeroOverlayBadges(shot)}
      </>
    );
  }

  return (
    <>
      <div className="flex size-full items-center justify-center">
        <Clapperboard
          className="size-8 opacity-20"
          style={{ color: canvasTheme.node.faint }}
        />
      </div>
      {shotHeroOverlayBadges(shot)}
    </>
  );
}

function nodeBody(shot: DramaShotCardDisplay): ReactNode {
  const cameraParts = [shot.shotSize, shot.movement, shot.lighting].filter(
    Boolean,
  );
  const cameraLine = cameraParts.length > 0 ? cameraParts.join(" · ") : null;

  return (
    <>
      {shot.dialogue ? (
        <div
          className="line-clamp-1 italic text-xs leading-snug"
          style={{ color: canvasTheme.node.muted }}
        >
          &ldquo;{shot.dialogue}&rdquo;
        </div>
      ) : null}
      {cameraLine ? (
        <div
          className="text-[11px] leading-snug"
          style={{ color: canvasTheme.node.faint }}
        >
          {cameraLine}
        </div>
      ) : null}
      {!shot.keyframeSrc && shot.visualPrompt ? (
        <div
          className="line-clamp-3 text-[11px] leading-relaxed"
          style={{ color: canvasTheme.node.faint }}
        >
          {shot.visualPrompt}
        </div>
      ) : null}
    </>
  );
}

function panelReadonlyBody(shot: DramaShotCardDisplay): ReactNode {
  const cameraParts = [shot.shotSize, shot.movement, shot.lighting].filter(
    Boolean,
  );
  const cameraLine = cameraParts.length > 0 ? cameraParts.join(" · ") : null;

  return (
    <>
      {shot.stripLabel || shot.shotOrder != null ? (
        <div className="text-sm font-semibold text-zinc-100">
          {shot.stripLabel ?? `镜 ${(shot.shotOrder ?? 0) + 1}`}
        </div>
      ) : null}
      {shot.dialogue ? (
        <p className="line-clamp-2 text-xs italic text-violet-300/90">
          「{shot.dialogue}」
        </p>
      ) : null}
      {cameraLine ? (
        <p className="text-[11px] text-zinc-500">{cameraLine}</p>
      ) : null}
      {shot.visualPrompt ? (
        <p className="line-clamp-3 text-[11px] leading-relaxed text-zinc-500">
          {shot.visualPrompt}
        </p>
      ) : null}
    </>
  );
}

function panelTimelineStrip({
  shot,
  timelineLeading,
}: {
  shot: DramaShotCardDisplay;
  timelineLeading?: ReactNode;
}) {
  return (
    <>
      <div className="relative aspect-[9/16] w-full bg-black/50">
        {shot.keyframeSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shot.keyframeSrc}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] text-zinc-600">
            待生成
          </div>
        )}
        {timelineLeading}
        {shot.durationSec != null ? (
          <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[9px] text-zinc-300">
            {shot.durationSec}s
          </span>
        ) : null}
      </div>
      <div className="space-y-0.5 p-2">
        <div className="text-[11px] font-medium text-zinc-200">
          {shot.stripLabel ?? `S${(shot.shotOrder ?? 0) + 1}`}
        </div>
        <p className="line-clamp-2 text-[10px] text-zinc-500">
          {shot.stripSummary ?? shot.visualPrompt ?? ""}
        </p>
      </div>
    </>
  );
}

function panelDefaultHero(shot: DramaShotCardDisplay): ReactNode {
  if (shot.keyframeSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={shot.keyframeSrc}
        alt={shot.stripLabel ?? "分镜"}
        className="size-full object-cover"
      />
    );
  }
  return (
    <div className="flex size-full flex-col items-center justify-center gap-1 text-zinc-600">
      <Clapperboard className="size-6 opacity-40" />
      <span className="text-[10px]">待生成关键帧</span>
    </div>
  );
}

export function DramaShotCardShell({
  mode,
  layout = "default",
  shot,
  testId,
  className,
  footer,
  children,
  timelineLeading,
}: DramaShotCardShellProps) {
  if (mode === "panel" && layout === "timeline") {
    return (
      <div className={className} data-testid={testId}>
        {panelTimelineStrip({ shot, timelineLeading })}
      </div>
    );
  }

  const compact = mode === "node";
  const hero = mode === "node" ? <ShotNodeHero shot={shot} /> : panelDefaultHero(shot);
  const badges =
    mode === "node" && shot.durationSec != null ? (
      <span className="inline-flex items-center gap-0.5">
        <Clock className="size-3" style={{ color: canvasTheme.node.faint }} />
        <DramaBadge color="#0ea5e9">{shot.durationSec}s</DramaBadge>
      </span>
    ) : shot.shotStatus ? (
      <DramaBadge color={SHOT_STATUS_COLORS[shot.shotStatus] || "#78716c"}>
        {SHOT_STATUS_LABELS[shot.shotStatus] || shot.shotStatus}
      </DramaBadge>
    ) : null;

  return (
    <DramaAssetCardShell
      category="shot"
      compact={compact}
      hero={hero}
      heroAspect={mode === "panel" ? "portrait" : "landscape"}
      testId={testId}
      className={className}
      badges={badges}
      footer={footer}
    >
      {mode === "node" ? nodeBody(shot) : panelReadonlyBody(shot)}
      {mode === "panel" ? children : null}
    </DramaAssetCardShell>
  );
}

/** 时间线拖拽把手（panel timeline 条带用） */
export function DramaShotTimelineGrip() {
  return (
    <span className="absolute left-1 top-1 rounded bg-black/60 p-0.5 text-zinc-400">
      <GripVertical className="size-3" />
    </span>
  );
}
