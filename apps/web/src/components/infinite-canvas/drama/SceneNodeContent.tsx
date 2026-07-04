import { MapPin } from "lucide-react";

import { DramaAssetCardShell } from "@/components/drama/drama-asset-card-shell";
import { DramaBadge } from "@/components/drama/drama-badge";
import { canvasTheme } from "../canvas-theme";
import type { CanvasNodeData } from "../types";

type SceneNodeContentProps = {
  node: CanvasNodeData;
};

export function SceneNodeContent({ node }: SceneNodeContentProps) {
  const m = node.metadata;
  const sceneName = m?.sceneName || node.title || "未命名场景";
  const location = m?.location;
  const atmosphere = m?.atmosphere;
  const era = m?.era;
  const sceneRefUrl = m?.sceneRefUrl;
  const promptAnchor = m?.scenePromptAnchor;

  const hero = sceneRefUrl ? (
    <img
      src={sceneRefUrl}
      alt={sceneName}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      className="pointer-events-none size-full select-none object-cover"
    />
  ) : (
    <div className="flex size-full flex-col items-center justify-center gap-1">
      <MapPin
        className="size-8 opacity-20"
        style={{ color: canvasTheme.node.faint }}
      />
      <span
        className="text-[10px]"
        style={{ color: canvasTheme.node.faint }}
      >
        场景参考图
      </span>
    </div>
  );

  return (
    <DramaAssetCardShell
      category="scene"
      compact
      hero={hero}
      heroAspect="landscape"
      testId="drama-canvas-scene-card"
      badges={
        <>
          {atmosphere ? (
            <DramaBadge color="#06b6d4">{atmosphere}</DramaBadge>
          ) : null}
          {era ? (
            <span className="text-[10px]" style={{ color: canvasTheme.node.faint }}>
              {era}
            </span>
          ) : null}
        </>
      }
    >
      <div
        className="truncate text-sm font-bold leading-snug"
        style={{ color: canvasTheme.node.text }}
      >
        {sceneName}
      </div>
      {location ? (
        <div className="flex items-center gap-1">
          <MapPin
            className="size-3 shrink-0"
            style={{ color: canvasTheme.node.faint }}
          />
          <span
            className="truncate text-xs leading-snug"
            style={{ color: canvasTheme.node.muted }}
          >
            {location}
          </span>
        </div>
      ) : null}
      {promptAnchor ? (
        <div
          className="line-clamp-2 text-[11px] leading-snug"
          style={{ color: canvasTheme.node.faint }}
        >
          {promptAnchor}
        </div>
      ) : null}
    </DramaAssetCardShell>
  );
}
