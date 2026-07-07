"use client";

import type { ReactNode } from "react";
import { MapPin } from "lucide-react";

import { DramaAssetCardShell } from "@/components/drama/drama-asset-card-shell";
import { DramaBadge } from "@/components/drama/drama-badge";
import { canvasTheme } from "@/components/infinite-canvas/canvas-theme";
import type { CanvasNodeData } from "@/components/infinite-canvas/types";
import type { DramaSceneCard } from "@/lib/types";

export type DramaSceneCardDisplay = {
  name: string;
  location?: string;
  atmosphere?: string;
  era?: string;
  promptAnchor?: string;
  refUrl?: string | null;
  generating?: boolean;
  error?: string | null;
};

export type DramaSceneCardShellProps = {
  mode: "panel" | "node";
  scene: DramaSceneCardDisplay;
  testId?: string;
  className?: string;
  footer?: ReactNode;
};

export function dramaSceneDisplayFromCard(
  scene: DramaSceneCard,
  opts?: { generating?: boolean; error?: string | null },
): DramaSceneCardDisplay {
  return {
    name: scene.name,
    location: scene.location,
    atmosphere: scene.atmosphere,
    era: scene.era,
    promptAnchor: scene.promptAnchor,
    refUrl: scene.refUrl,
    generating: opts?.generating,
    error: opts?.error,
  };
}

export function dramaSceneDisplayFromNode(
  node: CanvasNodeData,
): DramaSceneCardDisplay {
  const m = node.metadata;
  return {
    name: m?.sceneName || node.title || "未命名场景",
    location: m?.location,
    atmosphere: m?.atmosphere,
    era: m?.era,
    promptAnchor: m?.scenePromptAnchor,
    refUrl: m?.sceneRefUrl,
  };
}

function sceneHeroPlaceholder(
  mode: "panel" | "node",
  scene: DramaSceneCardDisplay,
): ReactNode {
  if (mode === "node") {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-1">
        <MapPin
          className="size-8 opacity-20"
          style={{ color: canvasTheme.node.faint }}
        />
        <span className="text-[10px]" style={{ color: canvasTheme.node.faint }}>
          场景参考图
        </span>
      </div>
    );
  }

  return (
    <div className="flex size-full flex-col items-center justify-center gap-1 text-zinc-600">
      <MapPin className="size-6 opacity-40" />
      <span className="text-[10px]">
        {scene.generating
          ? "生成中…"
          : scene.error
            ? "生成失败"
            : "待生成场景参考图"}
      </span>
    </div>
  );
}

export function DramaSceneCardShell({
  mode,
  scene,
  testId,
  className,
  footer,
}: DramaSceneCardShellProps) {
  const compact = mode === "node";
  const hero = scene.refUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={scene.refUrl}
      alt={scene.name}
      draggable={compact ? false : undefined}
      onDragStart={compact ? (e) => e.preventDefault() : undefined}
      className={
        compact
          ? "pointer-events-none size-full select-none object-cover"
          : "size-full object-cover"
      }
    />
  ) : (
    sceneHeroPlaceholder(mode, scene)
  );

  const badges = (
    <>
      {scene.atmosphere ? (
        <DramaBadge color="#06b6d4">{scene.atmosphere}</DramaBadge>
      ) : null}
      {scene.era ? (
        mode === "node" ? (
          <span className="text-[10px]" style={{ color: canvasTheme.node.faint }}>
            {scene.era}
          </span>
        ) : (
          <span className="text-[10px] text-zinc-500">{scene.era}</span>
        )
      ) : null}
    </>
  );

  return (
    <DramaAssetCardShell
      category="scene"
      compact={compact}
      hero={hero}
      heroAspect="landscape"
      testId={testId}
      className={className}
      badges={badges}
      footer={footer}
    >
      {mode === "node" ? (
        <>
          <div
            className="truncate text-sm font-bold leading-snug"
            style={{ color: canvasTheme.node.text }}
          >
            {scene.name}
          </div>
          {scene.location ? (
            <div className="flex items-center gap-1">
              <MapPin
                className="size-3 shrink-0"
                style={{ color: canvasTheme.node.faint }}
              />
              <span
                className="truncate text-xs leading-snug"
                style={{ color: canvasTheme.node.muted }}
              >
                {scene.location}
              </span>
            </div>
          ) : null}
          {scene.promptAnchor ? (
            <div
              className="line-clamp-2 text-[11px] leading-snug"
              style={{ color: canvasTheme.node.faint }}
            >
              {scene.promptAnchor}
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="text-sm font-semibold leading-snug text-zinc-100">
            {scene.name}
          </div>
          {scene.location ? (
            <div className="flex items-center gap-1 text-xs text-zinc-400">
              <MapPin className="size-3 shrink-0 opacity-70" />
              <span className="truncate">{scene.location}</span>
            </div>
          ) : null}
          {scene.promptAnchor ? (
            <p className="line-clamp-2 text-[11px] leading-relaxed text-zinc-500">
              {scene.promptAnchor}
            </p>
          ) : null}
          {scene.error ? (
            <p className="text-[10px] text-red-400/90">{scene.error}</p>
          ) : null}
        </>
      )}
    </DramaAssetCardShell>
  );
}
