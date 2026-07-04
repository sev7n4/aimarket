import { useState, type ReactNode } from "react";
import { Clapperboard, Clock, Grid3x3 } from "lucide-react";

import { DramaAssetCardShell } from "@/components/drama/drama-asset-card-shell";
import { DramaBadge } from "@/components/drama/drama-badge";
import { canvasTheme } from "../canvas-theme";
import type { CanvasNodeData } from "../types";
import { MultiCamGrid } from "./MultiCamGrid";

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

  const keyframeSrc =
    m?.content ||
    (m?.keyframeOutputId ? `/outputs/${m.keyframeOutputId}` : null);
  const hasKeyframe = Boolean(keyframeSrc);
  const hasVariants = keyframeVariantUrls.length > 0;
  const [showGrid, setShowGrid] = useState(false);

  const cameraParts = [shotSize, movement, lighting].filter(Boolean);
  const cameraLine = cameraParts.length > 0 ? cameraParts.join(" · ") : null;

  const variants = [
    ...(keyframeSrc
      ? [
          {
            id: m!.keyframeOutputId || "primary",
            url: keyframeSrc!,
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

  const heroOverlayBadges = (
    <>
      {shotOrder != null ? (
        <div className="absolute left-1.5 top-1.5 z-10">
          <DramaBadge color="#6366f1">#{shotOrder}</DramaBadge>
        </div>
      ) : null}
      {shotStatus ? (
        <div className="absolute right-1.5 top-1.5 z-10">
          <DramaBadge color={shotStatusColors[shotStatus] || "#78716c"}>
            {shotStatusLabels[shotStatus] || shotStatus}
          </DramaBadge>
        </div>
      ) : null}
    </>
  );

  let hero: ReactNode;
  if (hasVariants && showGrid) {
    hero = (
      <>
        <MultiCamGrid
          variants={variants}
          gridSize={variants.length > 9 ? 5 : 3}
          heroIndex={m?.keyframeHeroIndex}
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
        {heroOverlayBadges}
      </>
    );
  } else if (hasKeyframe) {
    hero = (
      <>
        <img
          src={keyframeSrc!}
          alt={`分镜 #${shotOrder ?? "?"}`}
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
        {heroOverlayBadges}
      </>
    );
  } else {
    hero = (
      <>
        <div className="flex size-full items-center justify-center">
          <Clapperboard
            className="size-8 opacity-20"
            style={{ color: canvasTheme.node.faint }}
          />
        </div>
        {heroOverlayBadges}
      </>
    );
  }

  return (
    <DramaAssetCardShell
      category="shot"
      compact
      hero={hero}
      heroAspect="landscape"
      testId="drama-canvas-shot-card"
      badges={
        durationSec != null ? (
          <span className="inline-flex items-center gap-0.5">
            <Clock className="size-3" style={{ color: canvasTheme.node.faint }} />
            <DramaBadge color="#0ea5e9">{durationSec}s</DramaBadge>
          </span>
        ) : null
      }
    >
      {dialogue ? (
        <div
          className="line-clamp-1 italic text-xs leading-snug"
          style={{ color: canvasTheme.node.muted }}
        >
          &ldquo;{dialogue}&rdquo;
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
      {!hasKeyframe && visualPrompt ? (
        <div
          className="line-clamp-3 text-[11px] leading-relaxed"
          style={{ color: canvasTheme.node.faint }}
        >
          {visualPrompt}
        </div>
      ) : null}
    </DramaAssetCardShell>
  );
}
