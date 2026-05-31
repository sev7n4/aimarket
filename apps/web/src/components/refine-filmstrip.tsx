"use client";

import { assetUrl } from "@/lib/api-client";
import type { CanvasItem } from "@/lib/canvas-tools";

interface RefineFilmstripProps {
  chain: CanvasItem[];
  rootItemId: string;
  activeItemId: string;
  onSelect: (itemId: string) => void;
}

export function RefineFilmstrip({
  chain,
  rootItemId,
  activeItemId,
  onSelect,
}: RefineFilmstripProps) {
  if (chain.length <= 1) return null;

  return (
    <div
      className="pointer-events-auto absolute bottom-14 left-3 right-3 z-20"
      data-testid="refine-filmstrip"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="rounded-xl border border-white/10 bg-black/75 px-2 py-2 shadow-xl backdrop-blur">
        <p className="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
          精修链 · {chain.length} 张
        </p>
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          {chain.map((item, index) => {
            const isRoot = item.id === rootItemId;
            const active = item.id === activeItemId;
            return (
              <button
                key={item.id}
                type="button"
                data-testid={`refine-filmstrip-${item.id}`}
                title={item.label ?? item.batchTitle ?? (isRoot ? "原图" : `版本 ${index}`)}
                onClick={() => onSelect(item.id)}
                className={`relative shrink-0 overflow-hidden rounded-lg border transition ${
                  active
                    ? "border-orange-400 ring-2 ring-orange-400/40"
                    : "border-white/15 hover:border-white/30"
                }`}
              >
                <img
                  src={assetUrl(item.url)}
                  alt=""
                  className="size-14 object-cover sm:size-16"
                  draggable={false}
                />
                <span
                  className={`absolute inset-x-0 bottom-0 truncate px-1 py-0.5 text-[9px] ${
                    active
                      ? "bg-orange-500/90 text-white"
                      : "bg-black/70 text-zinc-300"
                  }`}
                >
                  {isRoot ? "原图" : (item.label ?? `v${index}`)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
