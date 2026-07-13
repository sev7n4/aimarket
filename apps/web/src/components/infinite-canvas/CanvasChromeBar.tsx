"use client";

import type { ReactNode } from "react";
import { Activity, Grid3x3, Lock, Magnet } from "lucide-react";

import { canvasTheme } from "./canvas-theme";
import { INFINITE_ZOOM_BAR_HEIGHT } from "./infinite-canvas-layout";

export type CanvasChromeBarProps = {
  gridOn: boolean;
  snapOn: boolean;
  edgeAnimOn: boolean;
  viewLocked: boolean;
  onGridChange: (value: boolean) => void;
  onSnapChange: (value: boolean) => void;
  onEdgeAnimChange: (value: boolean) => void;
  onViewLockedChange: (value: boolean) => void;
};

type ToggleProps = {
  testId: string;
  active: boolean;
  title: string;
  onToggle: () => void;
  children: ReactNode;
};

function ChromeToggle({ testId, active, title, onToggle, children }: ToggleProps) {
  const activeStyle = { background: canvasTheme.toolbar.activeBg, color: canvasTheme.toolbar.activeText };
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={active}
      title={title}
      aria-label={title}
      className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:opacity-80"
      style={active ? activeStyle : { color: canvasTheme.toolbar.item }}
      onClick={onToggle}
    >
      {children}
    </button>
  );
}

export function CanvasChromeBar({
  gridOn,
  snapOn,
  edgeAnimOn,
  viewLocked,
  onGridChange,
  onSnapChange,
  onEdgeAnimChange,
  onViewLockedChange,
}: CanvasChromeBarProps) {
  const dockStyle = {
    background: canvasTheme.toolbar.panel,
    borderColor: canvasTheme.toolbar.border,
    color: canvasTheme.toolbar.item,
    boxShadow: "0 12px 32px rgba(0,0,0,.28)",
  };

  return (
    <div
      className="flex items-center gap-0.5 rounded-lg border px-1.5 shadow-lg backdrop-blur"
      style={{ ...dockStyle, height: INFINITE_ZOOM_BAR_HEIGHT }}
      data-testid="canvas-chrome-bar"
    >
      <ChromeToggle
        testId="canvas-toggle-grid"
        active={gridOn}
        title={gridOn ? "隐藏网格" : "显示网格"}
        onToggle={() => onGridChange(!gridOn)}
      >
        <Grid3x3 className="size-3.5" />
      </ChromeToggle>
      <ChromeToggle
        testId="canvas-toggle-snap"
        active={snapOn}
        title={snapOn ? "关闭吸附 (L)" : "开启吸附 (L)"}
        onToggle={() => onSnapChange(!snapOn)}
      >
        <Magnet className="size-3.5" />
      </ChromeToggle>
      <ChromeToggle
        testId="canvas-toggle-edge-anim"
        active={edgeAnimOn}
        title={edgeAnimOn ? "关闭连线动画" : "开启连线动画"}
        onToggle={() => onEdgeAnimChange(!edgeAnimOn)}
      >
        <Activity className="size-3.5" />
      </ChromeToggle>
      <ChromeToggle
        testId="canvas-toggle-lock-view"
        active={viewLocked}
        title={viewLocked ? "解锁视角" : "锁定视角"}
        onToggle={() => onViewLockedChange(!viewLocked)}
      >
        <Lock className="size-3.5" />
      </ChromeToggle>
    </div>
  );
}
