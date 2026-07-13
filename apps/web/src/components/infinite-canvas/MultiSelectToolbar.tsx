"use client";

import { Download, LayoutGrid, Link2, Trash2, Users } from "lucide-react";

import { canvasTheme } from "./canvas-theme";

export type MultiSelectToolbarProps = {
  left: number;
  top: number;
  count: number;
  readOnly?: boolean;
  onGroup: () => void;
  onLayout: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onConnectHandleMouseDown: (event: React.MouseEvent) => void;
};

type ActionButtonProps = {
  testId: string;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
};

function ActionButton({ testId, title, onClick, children }: ActionButtonProps) {
  return (
    <button
      type="button"
      data-testid={testId}
      title={title}
      aria-label={title}
      className="flex h-7 items-center gap-1 rounded-md px-2 text-[11px] transition-colors hover:bg-white/10"
      style={{ color: canvasTheme.toolbar.item }}
      onClick={onClick}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {children}
    </button>
  );
}

export function MultiSelectToolbar({
  left,
  top,
  count,
  readOnly = false,
  onGroup,
  onLayout,
  onDownload,
  onDelete,
  onConnectHandleMouseDown,
}: MultiSelectToolbarProps) {
  if (readOnly) return null;

  const panelStyle = {
    background: canvasTheme.toolbar.panel,
    borderColor: canvasTheme.toolbar.border,
    boxShadow: "0 12px 32px rgba(0,0,0,.28)",
  };

  return (
    <div
      className="pointer-events-auto absolute z-[60] flex -translate-x-1/2 items-center gap-0.5 rounded-lg border px-1 py-0.5 backdrop-blur-md"
      style={{ left, top, ...panelStyle }}
      data-testid="multi-select-toolbar"
      data-canvas-no-zoom
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <span
        className="px-1.5 text-[10px] font-medium tabular-nums"
        style={{ color: canvasTheme.node.muted }}
      >
        {count} 项
      </span>
      <ActionButton testId="multi-select-group" title="分组" onClick={onGroup}>
        <Users className="size-3.5" strokeWidth={1.75} />
        <span>分组</span>
      </ActionButton>
      <ActionButton testId="multi-select-layout" title="布局" onClick={onLayout}>
        <LayoutGrid className="size-3.5" strokeWidth={1.75} />
        <span>布局</span>
      </ActionButton>
      <ActionButton
        testId="multi-select-download"
        title="打包下载"
        onClick={onDownload}
      >
        <Download className="size-3.5" strokeWidth={1.75} />
        <span>下载</span>
      </ActionButton>
      <ActionButton testId="multi-select-delete" title="删除" onClick={onDelete}>
        <Trash2 className="size-3.5" strokeWidth={1.75} />
        <span>删除</span>
      </ActionButton>
      <button
        type="button"
        data-testid="multi-select-connect-handle"
        title="批量连线：拖到目标节点"
        aria-label="批量连线"
        className="ml-0.5 flex h-7 w-7 cursor-crosshair items-center justify-center rounded-md border transition-colors hover:bg-indigo-500/20"
        style={{
          borderColor: "rgba(99,102,241,0.35)",
          color: "#a5b4fc",
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onConnectHandleMouseDown(e);
        }}
      >
        <Link2 className="size-3.5" strokeWidth={1.75} />
      </button>
    </div>
  );
}
