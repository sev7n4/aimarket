"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { CompactDockSheet } from "@/components/compact-dock-sheet";

interface CountPickerProps {
  value: number;
  onChange: (n: number) => void;
  max?: number;
}

export function CountPicker({ value, onChange, max = 4 }: CountPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <CompactDockSheet
      open={open}
      onClose={() => setOpen(false)}
      title="输出张数"
      desktopWidthClass="w-40"
      matchTriggerWidth
      placement="above"
      maxHeight="min(200px,30vh)"
      trigger={
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/10"
          aria-label="生成数量"
        >
          {value}张
          <ChevronDown
            className={`size-3 opacity-60 ${open ? "rotate-180" : ""}`}
          />
        </button>
      }
    >
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => {
              onChange(n);
              setOpen(false);
            }}
            className={`rounded-xl py-2.5 text-sm font-medium transition ${
              value === n
                ? "bg-orange-500 text-white"
                : "bg-white/5 text-zinc-400 hover:bg-white/10"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </CompactDockSheet>
  );
}
