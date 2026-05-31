"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { CompactDockSheet } from "@/components/compact-dock-sheet";

interface CountPickerProps {
  value: number;
  onChange: (n: number) => void;
  max?: number;
}

function CountPreview({
  count,
  selected,
}: {
  count: number;
  selected: boolean;
}) {
  return (
    <span
      className={`flex h-6 w-7 items-center justify-center rounded border text-[10px] font-medium leading-none ${
        selected
          ? "border-orange-500/70 bg-orange-500/15 text-orange-100"
          : "border-white/25 bg-white/[0.03] text-zinc-500"
      }`}
      aria-hidden
    >
      {count}
    </span>
  );
}

export function CountPicker({ value, onChange, max = 4 }: CountPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <CompactDockSheet
      open={open}
      onClose={() => setOpen(false)}
      title="输出张数"
      dense
      desktopWidthClass="w-[min(100vw-1.5rem,10.5rem)]"
      placement="above"
      maxHeight="min(120px,28vh)"
      trigger={
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-1 text-xs text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
          aria-label="生成数量"
        >
          {value}张
          <ChevronDown
            className={`size-3 opacity-50 transition ${open ? "rotate-180" : ""}`}
          />
        </button>
      }
    >
      <div className="grid grid-cols-4 gap-0.5">
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => {
          const selected = value === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => {
                onChange(n);
                setOpen(false);
              }}
              className={`flex items-center justify-center rounded-md p-1 transition ${
                selected ? "text-orange-100" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <CountPreview count={n} selected={selected} />
            </button>
          );
        })}
      </div>
    </CompactDockSheet>
  );
}
