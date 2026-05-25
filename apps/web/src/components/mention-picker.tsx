"use client";

import type { SessionReference } from "@/lib/types";
import { assetUrl } from "@/lib/api-client";

interface MentionPickerProps {
  references: SessionReference[];
  open: boolean;
  onSelect: (ref: SessionReference) => void;
  onClose: () => void;
}

export function MentionPicker({
  references,
  open,
  onSelect,
  onClose,
}: MentionPickerProps) {
  if (!open) return null;

  return (
    <div className="absolute bottom-full left-0 z-20 mb-2 w-full max-w-sm rounded-xl border border-white/10 bg-zinc-900 p-2 shadow-xl">
      <div className="mb-2 flex items-center justify-between px-2 text-xs text-zinc-500">
        <span>引用历史生成图</span>
        <button type="button" onClick={onClose} className="hover:text-zinc-300">
          关闭
        </button>
      </div>
      {references.length === 0 ? (
        <p className="px-2 py-3 text-xs text-zinc-600">暂无可引用的图片</p>
      ) : (
        <ul className="max-h-40 overflow-y-auto">
          {references.map((ref) => (
            <li key={ref.id}>
              <button
                type="button"
                onClick={() => onSelect(ref)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-white/10"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={assetUrl(ref.url)}
                  alt=""
                  className="size-8 rounded object-cover"
                />
                <span className="truncate text-zinc-300">{ref.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
