"use client";

import { MapPin } from "lucide-react";

import { DramaAssetCardShell } from "@/components/drama/drama-asset-card-shell";
import { DramaBadge } from "@/components/drama/drama-badge";
import type { DramaSceneCard } from "@/lib/types";

type DramaSceneCardViewProps = {
  scene: DramaSceneCard;
  readOnly?: boolean;
  busy?: boolean;
  uploadingRef?: boolean;
  onUploadRef?: () => void;
};

/** Agent 面板：场景资产卡片 */
export function DramaSceneCardView({
  scene,
  readOnly,
  busy,
  uploadingRef,
  onUploadRef,
}: DramaSceneCardViewProps) {
  const hero = scene.refUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={scene.refUrl}
      alt={scene.name}
      className="size-full object-cover"
    />
  ) : (
    <div className="flex size-full flex-col items-center justify-center gap-1 text-zinc-600">
      <MapPin className="size-6 opacity-40" />
      <span className="text-[10px]">待上传场景参考图</span>
    </div>
  );

  return (
    <DramaAssetCardShell
      category="scene"
      hero={hero}
      heroAspect="landscape"
      testId={`drama-scene-card-${scene.id}`}
      className="rounded-lg border border-white/10 bg-black/20"
      badges={
        <>
          {scene.atmosphere ? (
            <DramaBadge color="#06b6d4">{scene.atmosphere}</DramaBadge>
          ) : null}
          {scene.era ? (
            <span className="text-[10px] text-zinc-500">{scene.era}</span>
          ) : null}
        </>
      }
      footer={
        !readOnly && onUploadRef ? (
          <button
            type="button"
            disabled={busy || uploadingRef}
            className="text-[10px] text-cyan-300 hover:text-cyan-200 disabled:opacity-50"
            onClick={onUploadRef}
          >
            {uploadingRef
              ? "上传中…"
              : scene.refUrl
                ? "替换参考图"
                : "上传参考图"}
          </button>
        ) : null
      }
    >
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
    </DramaAssetCardShell>
  );
}
