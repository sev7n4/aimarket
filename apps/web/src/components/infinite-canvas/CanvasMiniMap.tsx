"use client";

import { ChevronDown, Search } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

import { canvasTheme } from "./canvas-theme";
import { infiniteMiniMapBottom } from "./infinite-canvas-layout";
import { CanvasNodeType, type CanvasNodeData, type ViewportTransform } from "./types";

const COMPACT_WIDTH = 176;
const COMPACT_HEIGHT = 112;
const EXPANDED_WIDTH = 220;
const EXPANDED_MAP_HEIGHT = 168;
const SEARCH_PANEL_HEIGHT = 112;

type CanvasMiniMapProps = {
  nodes: CanvasNodeData[];
  viewport: ViewportTransform;
  viewportSize: { width: number; height: number };
  onViewportChange: (viewport: ViewportTransform) => void;
  bottomInsetPx?: number;
};

export function CanvasMiniMap({
  nodes,
  viewport,
  viewportSize,
  onViewportChange,
  bottomInsetPx = 0,
}: CanvasMiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const width = expanded ? EXPANDED_WIDTH : COMPACT_WIDTH;
  const mapHeight = expanded ? EXPANDED_MAP_HEIGHT : COMPACT_HEIGHT;
  const panelHeight = expanded ? SEARCH_PANEL_HEIGHT + EXPANDED_MAP_HEIGHT : COMPACT_HEIGHT;

  const { worldBounds, scale, offset } = useMemo(() => {
    if (!nodes.length) {
      return { worldBounds: { x: -500, y: -500, w: 1000, h: 1000 }, scale: 0.16, offset: { x: 40, y: 0 } };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    nodes.forEach((node) => {
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + node.width);
      maxY = Math.max(maxY, node.position.y + node.height);
    });

    minX -= 500;
    minY -= 500;
    maxX += 500;
    maxY += 500;

    const boundsWidth = maxX - minX;
    const boundsHeight = maxY - minY;
    const nextScale = Math.min(width / boundsWidth, mapHeight / boundsHeight);
    const mapContentW = boundsWidth * nextScale;
    const mapContentH = boundsHeight * nextScale;

    return {
      worldBounds: { x: minX, y: minY, w: boundsWidth, h: boundsHeight },
      scale: nextScale,
      offset: { x: (width - mapContentW) / 2, y: (mapHeight - mapContentH) / 2 },
    };
  }, [mapHeight, nodes, width]);

  const toMinimap = useCallback(
    (worldX: number, worldY: number) => {
      return {
        x: (worldX - worldBounds.x) * scale + offset.x,
        y: (worldY - worldBounds.y) * scale + offset.y,
      };
    },
    [offset.x, offset.y, scale, worldBounds.x, worldBounds.y],
  );

  const toWorld = useCallback(
    (minimapX: number, minimapY: number) => {
      return {
        x: (minimapX - offset.x) / scale + worldBounds.x,
        y: (minimapY - offset.y) / scale + worldBounds.y,
      };
    },
    [offset.x, offset.y, scale, worldBounds.x, worldBounds.y],
  );

  const viewportRect = useMemo(() => {
    const vx = -viewport.x / viewport.k;
    const vy = -viewport.y / viewport.k;
    const vw = viewportSize.width / viewport.k;
    const vh = viewportSize.height / viewport.k;
    const p1 = toMinimap(vx, vy);
    const p2 = toMinimap(vx + vw, vy + vh);

    return {
      x: p1.x,
      y: p1.y,
      w: Math.max(p2.x - p1.x, 4),
      h: Math.max(p2.y - p1.y, 4),
    };
  }, [toMinimap, viewport.k, viewport.x, viewport.y, viewportSize.height, viewportSize.width]);

  const centerOnNode = useCallback(
    (node: CanvasNodeData) => {
      const cx = node.position.x + node.width / 2;
      const cy = node.position.y + node.height / 2;
      onViewportChange({
        x: viewportSize.width / 2 - cx * viewport.k,
        y: viewportSize.height / 2 - cy * viewport.k,
        k: viewport.k,
      });
    },
    [onViewportChange, viewport.k, viewportSize.height, viewportSize.width],
  );

  const matchingNodes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return nodes.filter((node) => node.title.toLowerCase().includes(q));
  }, [nodes, searchQuery]);

  const updateViewportFromEvent = (event: React.PointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const world = toWorld(event.clientX - rect.left, event.clientY - rect.top);
    onViewportChange({
      x: viewportSize.width / 2 - world.x * viewport.k,
      y: viewportSize.height / 2 - world.y * viewport.k,
      k: viewport.k,
    });
  };

  return (
    <div
      className="absolute right-4 z-50 overflow-hidden rounded-lg border shadow-xl backdrop-blur-sm"
      style={{
        width,
        height: panelHeight,
        bottom: infiniteMiniMapBottom(bottomInsetPx),
        background: canvasTheme.toolbar.panel,
        borderColor: canvasTheme.toolbar.border,
      }}
      data-testid="canvas-minimap"
      data-canvas-no-zoom
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {expanded ? (
        <div
          className="border-b px-2 py-1.5"
          style={{ borderColor: canvasTheme.toolbar.border, height: SEARCH_PANEL_HEIGHT }}
        >
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2"
              style={{ color: canvasTheme.node.muted }}
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="搜索节点标题…"
              data-testid="canvas-minimap-search"
              className="w-full rounded-md border py-1 pl-7 pr-2 text-[11px] outline-none"
              style={{
                background: canvasTheme.toolbar.activeBg,
                borderColor: canvasTheme.toolbar.border,
                color: canvasTheme.node.text,
              }}
            />
          </div>
          <ul className="mt-1 max-h-16 space-y-0.5 overflow-y-auto text-[10px]">
            {searchQuery.trim() && matchingNodes.length === 0 ? (
              <li className="px-1 py-0.5" style={{ color: canvasTheme.node.muted }}>
                无匹配节点
              </li>
            ) : null}
            {matchingNodes.map((node) => (
              <li key={node.id}>
                <button
                  type="button"
                  className="w-full truncate rounded px-1 py-0.5 text-left transition-colors hover:bg-white/10"
                  style={{ color: canvasTheme.toolbar.item }}
                  onClick={() => centerOnNode(node)}
                >
                  {node.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="relative" style={{ height: mapHeight }}>
        <button
          type="button"
          data-testid="canvas-minimap-expand"
          aria-expanded={expanded}
          aria-label={expanded ? "收起小地图面板" : "展开小地图面板"}
          title={expanded ? "收起" : "展开搜索"}
          className="absolute right-1 top-1 z-10 flex size-5 items-center justify-center rounded transition-colors hover:bg-white/10"
          style={{ color: canvasTheme.toolbar.item }}
          onClick={() => setExpanded((value) => !value)}
        >
          <ChevronDown
            className={`size-3 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>

        <div
          ref={containerRef}
          className="relative h-full w-full cursor-crosshair"
          onPointerDown={(event) => {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            setIsDragging(true);
            updateViewportFromEvent(event);
          }}
          onPointerMove={(event) => {
            if (isDragging) updateViewportFromEvent(event);
          }}
          onPointerUp={() => setIsDragging(false)}
          onPointerLeave={() => setIsDragging(false)}
        >
          {nodes.map((node) => {
            const pos = toMinimap(node.position.x, node.position.y);
            const color =
              node.type === CanvasNodeType.Image
                ? "#10b981"
                : node.type === CanvasNodeType.Video
                  ? "#f97316"
                  : node.type === CanvasNodeType.Audio
                    ? "#a855f7"
                    : node.type === CanvasNodeType.Config
                      ? "#60a5fa"
                      : canvasTheme.node.muted;
            return (
              <div
                key={node.id}
                className="absolute rounded-[1px]"
                style={{
                  left: pos.x,
                  top: pos.y,
                  width: Math.max(node.width * scale, 2),
                  height: Math.max(node.height * scale, 2),
                  backgroundColor: color,
                  opacity: 0.8,
                }}
              />
            );
          })}
          <div
            className="pointer-events-none absolute border"
            style={{
              left: viewportRect.x,
              top: viewportRect.y,
              width: viewportRect.w,
              height: viewportRect.h,
              borderColor: canvasTheme.node.activeStroke,
              background: `${canvasTheme.node.activeStroke}18`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
