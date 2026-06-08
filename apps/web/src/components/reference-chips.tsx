"use client";

import { X } from "lucide-react";
import { assetUrl } from "@/lib/api-client";

export type ReferenceChipVariant =
  | "canvas"
  | "mention-output"
  | "mention-asset";

export interface ReferenceChipItem {
  id: string;
  variant: ReferenceChipVariant;
  label: string;
  url?: string;
}

const VARIANT_META: Record<
  ReferenceChipVariant,
  { prefix: string; chipClass: string; testId: string }
> = {
  canvas: {
    prefix: "画布参考",
    chipClass:
      "border-sky-400/30 bg-sky-500/10 text-sky-100 hover:border-sky-300/50",
    testId: "reference-chip-canvas",
  },
  "mention-output": {
    prefix: "已 @ 引用",
    chipClass:
      "border-purple-400/30 bg-purple-500/10 text-purple-100 hover:border-purple-300/50",
    testId: "reference-chip-mention-output",
  },
  "mention-asset": {
    prefix: "已 @ 引用",
    chipClass:
      "border-purple-400/30 bg-purple-500/10 text-purple-100 hover:border-purple-300/50",
    testId: "reference-chip-mention-asset",
  },
};

interface ReferenceChipsProps {
  chips: ReferenceChipItem[];
  onRemove: (chip: ReferenceChipItem) => void;
}

/** Dock 引用条：画布点选 / @ 生成图 / @ 素材，均可点击 × 取消 */
export function ReferenceChips({ chips, onRemove }: ReferenceChipsProps) {
  if (chips.length === 0) return null;

  const grouped = {
    canvas: chips.filter((c) => c.variant === "canvas"),
    mention: chips.filter((c) => c.variant !== "canvas"),
  };

  return (
    <div
      data-testid="reference-chips"
      className="mt-1.5 flex flex-col gap-1.5"
    >
      {grouped.canvas.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-medium text-sky-400/90">
            画布参考
          </span>
          {grouped.canvas.map((chip) => (
            <ReferenceChip
              key={`${chip.variant}-${chip.id}`}
              chip={chip}
              onRemove={onRemove}
            />
          ))}
        </div>
      ) : null}
      {grouped.mention.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-medium text-purple-400/90">
            已 @ 引用
          </span>
          {grouped.mention.map((chip) => (
            <ReferenceChip
              key={`${chip.variant}-${chip.id}`}
              chip={chip}
              onRemove={onRemove}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ReferenceChip({
  chip,
  onRemove,
}: {
  chip: ReferenceChipItem;
  onRemove: (chip: ReferenceChipItem) => void;
}) {
  const meta = VARIANT_META[chip.variant];
  const thumbSrc = chip.url ? assetUrl(chip.url) : undefined;

  return (
    <span
      data-testid={meta.testId}
      data-reference-id={chip.id}
      className={`inline-flex max-w-full items-center gap-1 rounded-full border py-0.5 pl-1.5 pr-1 text-[11px] transition ${meta.chipClass}`}
    >
      {thumbSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbSrc}
          alt=""
          className="size-4 shrink-0 rounded-full object-cover"
        />
      ) : null}
      <span className="max-w-[8rem] truncate">{chip.label}</span>
      <button
        type="button"
        data-testid={`reference-chip-remove-${chip.id}`}
        onClick={() => onRemove(chip)}
        className="flex size-5 shrink-0 items-center justify-center rounded-full text-current/70 transition hover:bg-white/10 hover:text-current"
        aria-label={`取消引用 ${chip.label}`}
      >
        <X className="size-3" strokeWidth={2} />
      </button>
    </span>
  );
}
