import React, { type ReactNode } from "react";
import { MapPin } from "lucide-react";

import type { CanvasNodeData } from "../types";
import { canvasTheme } from "../canvas-theme";
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

  return (
    <div className="flex h-full w-full flex-col gap-2 p-3">
      {/* Scene name */}
      <div
        className="truncate text-sm font-bold leading-snug"
        style={{ color: canvasTheme.node.text }}
      >
        {sceneName}
      </div>

      {/* Location with icon */}
      {location && (
        <div className="flex items-center gap-1.5">
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
      )}

      {/* Atmosphere badge + Era */}
      <div className="flex flex-wrap items-center gap-1.5">
        {atmosphere && (
          <Badge color="#0ea5e9">{atmosphere}</Badge>
        )}
        {era && (
          <span
            className="text-xs"
            style={{ color: canvasTheme.node.faint }}
          >
            {era}
          </span>
        )}
      </div>

      {/* Ref image thumbnail */}
      {sceneRefUrl && (
        <div
          className="mt-auto aspect-video w-full overflow-hidden rounded-md"
          style={{ background: canvasTheme.node.panel }}
        >
          <img
            src={sceneRefUrl}
            alt={sceneName}
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            className="pointer-events-none size-full select-none object-cover"
          />
        </div>
      )}
    </div>
  );
}
