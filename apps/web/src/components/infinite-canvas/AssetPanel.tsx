"use client";

import { Film, ImageIcon } from "lucide-react";
import { cn } from "@aimarket/ui";
import { assetUrl } from "@/lib/api-client";
import type { CanvasItem } from "@/lib/canvas-tools";
import {
  listSessionMediaAssets,
  SESSION_ASSET_DRAG_TYPE,
} from "@/lib/canvas-asset-drag";

type AssetPanelProps = {
  items: CanvasItem[];
  onApply: (itemId: string) => void;
  readOnly?: boolean;
};

export function AssetPanel({ items, onApply, readOnly = false }: AssetPanelProps) {
  const assets = listSessionMediaAssets(items);

  return (
    <div
      data-testid="asset-panel"
      className="flex min-h-0 flex-1 flex-col"
      aria-label="会话资产"
    >
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {assets.length === 0 ? (
          <p className="px-2 py-4 text-center text-[11px] leading-relaxed text-zinc-500">
            当前会话暂无图片或视频资产。生成或上传后会出现在这里。
          </p>
        ) : (
          <ul className="space-y-1">
            {assets.map((item) => (
              <li key={item.id}>
                <div
                  draggable={!readOnly}
                  data-testid={`asset-panel-item-${item.id}`}
                  onDragStart={(event) => {
                    if (readOnly) return;
                    event.dataTransfer.setData(SESSION_ASSET_DRAG_TYPE, item.id);
                    event.dataTransfer.effectAllowed = "copy";
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 transition",
                    readOnly
                      ? "cursor-default opacity-60"
                      : "cursor-grab hover:border-white/10 hover:bg-white/5 active:cursor-grabbing",
                  )}
                >
                  <div className="relative size-10 shrink-0 overflow-hidden rounded-md bg-zinc-900">
                    {item.isVideo ? (
                      <div className="flex size-full items-center justify-center text-zinc-500">
                        <Film className="size-4" />
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={assetUrl(item.thumbUrl ?? item.url)}
                        alt=""
                        className="size-full object-cover"
                        draggable={false}
                      />
                    )}
                    {item.isVideo ? (
                      <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 text-[8px] text-zinc-300">
                        视频
                      </span>
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-zinc-200">
                      {item.label || item.batchTitle || (item.isVideo ? "视频" : "图片")}
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] text-zinc-500">
                      {item.isVideo ? "拖到画布复用" : "拖到画布复用"}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={readOnly}
                    data-testid={`asset-panel-apply-${item.id}`}
                    onClick={() => onApply(item.id)}
                    className={cn(
                      "shrink-0 rounded px-2 py-1 text-[10px] font-medium transition",
                      readOnly
                        ? "cursor-not-allowed text-zinc-600"
                        : "bg-violet-500/15 text-violet-200 hover:bg-violet-500/25",
                    )}
                  >
                    应用
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {assets.length > 0 ? (
        <div className="border-t border-white/10 px-3 py-2">
          <p className="flex items-center gap-1.5 text-[10px] text-zinc-500">
            <ImageIcon className="size-3 shrink-0" />
            拖拽或点「应用」在画布创建副本
          </p>
        </div>
      ) : null}
    </div>
  );
}
