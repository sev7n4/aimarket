"use client";

import { useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import type { ImageModel } from "@/lib/types";
import { CompactDockSheet } from "@/components/compact-dock-sheet";

export const AUTO_MODEL_ID = "auto";

interface ModelPickerProps {
  models: ImageModel[];
  value: string;
  onChange: (id: string) => void;
}

function modelOptionClass(selected: boolean) {
  return `block max-w-full truncate whitespace-nowrap rounded-md px-2 py-1.5 text-left text-[11px] font-medium transition ${
    selected
      ? "bg-orange-500 text-white"
      : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
  }`;
}

function sectionLabelClass() {
  return "mb-1 mt-2 text-[9px] font-medium uppercase tracking-wide text-zinc-600";
}

export function ModelPicker({ models, value, onChange }: ModelPickerProps) {
  const [open, setOpen] = useState(false);

  const list = models;

  const label =
    value === AUTO_MODEL_ID
      ? "Auto"
      : list.find((m) => m.id === value)?.name ?? "选择模型";

  function pick(id: string) {
    onChange(id);
    setOpen(false);
  }

  const imageModels = list.filter((m) => m.type === "image");
  const videoModels = list.filter((m) => m.type === "video");
  const showSections = imageModels.length > 0 && videoModels.length > 0;

  return (
    <CompactDockSheet
      open={open}
      onClose={() => setOpen(false)}
      title="模型"
      dense
      fitContent
      placement="above"
      maxHeight="min(240px,42vh)"
      trigger={
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex max-w-[7.5rem] shrink-0 items-center gap-0.5 truncate rounded-md px-1.5 py-1 text-xs text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200 sm:max-w-[9rem]"
          aria-label="选择模型"
        >
          <Sparkles className="size-3 shrink-0 text-orange-400/90" />
          <span className="truncate">{label}</span>
          <ChevronDown
            className={`size-3 shrink-0 opacity-50 transition ${open ? "rotate-180" : ""}`}
          />
        </button>
      }
    >
      <ul className="flex flex-col gap-0.5">
        <li>
          <button
            type="button"
            onClick={() => pick(AUTO_MODEL_ID)}
            className={modelOptionClass(value === AUTO_MODEL_ID)}
          >
            Auto
          </button>
        </li>
      </ul>

      {imageModels.length > 0 ? (
        <>
          {showSections ? (
            <p className={sectionLabelClass()}>图片模型</p>
          ) : null}
          <ul className="flex flex-col gap-0.5">
            {imageModels.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => pick(m.id)}
                  className={modelOptionClass(value === m.id)}
                >
                  {m.name}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {videoModels.length > 0 ? (
        <>
          {showSections ? (
            <p className={sectionLabelClass()}>视频模型</p>
          ) : null}
          <ul className="flex flex-col gap-0.5">
            {videoModels.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => pick(m.id)}
                  className={modelOptionClass(value === m.id)}
                >
                  {m.name}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </CompactDockSheet>
  );
}
