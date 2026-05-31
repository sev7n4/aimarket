"use client";

import type { AspectRatio } from "@/components/generation-settings-popover";

/** 椒图风格：矩形线框示意比例 */
export function AspectRatioPreview({
  ratio,
  selected,
  smart,
  compact = false,
}: {
  ratio: AspectRatio;
  selected?: boolean;
  smart?: boolean;
  compact?: boolean;
}) {
  const slotClass = compact ? "h-6 w-7" : "h-7 w-9";
  const maxDim = compact ? 22 : 28;
  const selectedBorder = selected
    ? "border-orange-500/70 bg-orange-500/15"
    : "border-white/25 bg-white/5";
  const ratioBorder = selected
    ? "border-orange-500/70 bg-orange-500/15"
    : "border-white/30 bg-white/[0.03]";

  if (smart || ratio === "auto") {
    return (
      <span
        className={`flex items-center justify-center rounded border ${slotClass} ${selectedBorder}`}
        aria-hidden
      >
        <SparkleIcon className={compact ? "size-2.5 opacity-80" : "size-3 opacity-80"} />
      </span>
    );
  }

  const [w, h] = ratio.split(":").map(Number);
  const scale = maxDim / Math.max(w, h);
  const boxW = Math.max(8, Math.round(w * scale));
  const boxH = Math.max(8, Math.round(h * scale));

  return (
    <span
      className={`flex items-center justify-center ${slotClass}`}
      aria-hidden
    >
      <span
        className={`rounded-[2px] border ${ratioBorder}`}
        style={{ width: boxW, height: boxH }}
      />
    </span>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <path d="M12 3l1.2 4.2L17 8.5l-3.8 1.3L12 14l-1.2-4.2L7 8.5l3.8-1.3L12 3z" />
      <path d="M5 16l.6 2.1L8 19l-2.1.7L5 22l-.6-2.1L2 19l2.1-.7L5 16z" />
    </svg>
  );
}
