"use client";

import type { CanvasItem } from "@/lib/canvas-tools";

interface CanvasContextMenuProps {
  item: CanvasItem;
  x: number;
  y: number;
  onClose: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onCutout?: () => void;
  onExpand?: () => void;
}

/** P3-2：画布长按上下文菜单 */
export function CanvasContextMenu({
  item,
  x,
  y,
  onClose,
  onDownload,
  onDelete,
  onCutout,
  onExpand,
}: CanvasContextMenuProps) {
  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-50"
        aria-label="关闭菜单"
        onClick={onClose}
      />
      <div
        className="fixed z-[51] min-w-[140px] rounded-xl border border-white/10 bg-[#141414] py-1 shadow-2xl"
        style={{ left: x, top: y }}
      >
        {onCutout && item.outputId ? (
          <button
            type="button"
            className="block w-full px-4 py-2 text-left text-xs text-zinc-300 hover:bg-white/5"
            onClick={() => {
              onCutout();
              onClose();
            }}
          >
            抠图
          </button>
        ) : null}
        {onExpand && item.outputId ? (
          <button
            type="button"
            className="block w-full px-4 py-2 text-left text-xs text-zinc-300 hover:bg-white/5"
            onClick={() => {
              onExpand();
              onClose();
            }}
          >
            扩图
          </button>
        ) : null}
        <button
          type="button"
          className="block w-full px-4 py-2 text-left text-xs text-zinc-300 hover:bg-white/5"
          onClick={() => {
            onDownload();
            onClose();
          }}
        >
          下载
        </button>
        <button
          type="button"
          className="block w-full px-4 py-2 text-left text-xs text-red-400 hover:bg-white/5"
          onClick={() => {
            onDelete();
            onClose();
          }}
        >
          删除
        </button>
      </div>
    </>
  );
}
