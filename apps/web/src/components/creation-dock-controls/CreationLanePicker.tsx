"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { CompactDockSheet } from "@/components/compact-dock-sheet";
import {
  CREATION_LANE_LABELS,
  type CreationLane,
} from "@/lib/creation-dock-prefs";
import { DOCK_PILL, laneIcon } from "./shared";

interface CreationLanePickerProps {
  value: CreationLane;
  onChange: (lane: CreationLane) => void;
  agentAvailable: boolean;
  disabled?: boolean;
}

export function CreationLanePicker({
  value,
  onChange,
  agentAvailable,
  disabled = false,
}: CreationLanePickerProps) {
  const [open, setOpen] = useState(false);
  const lanes = useMemo(() => {
    const base: CreationLane[] = agentAvailable
      ? ["agent", "image", "video"]
      : ["image", "video"];
    return base;
  }, [agentAvailable]);

  return (
    <CompactDockSheet
      open={open}
      onClose={() => setOpen(false)}
      title="创作方式"
      dense
      fitContent
      placement="above"
      maxHeight="min(280px,46vh)"
      trigger={
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className={`${DOCK_PILL} disabled:opacity-50`}
          aria-label="选择创作方式"
        >
          {laneIcon(value)}
          <span className="truncate">{CREATION_LANE_LABELS[value]}</span>
          <ChevronDown
            className={`size-3 shrink-0 opacity-50 transition ${open ? "rotate-180" : ""}`}
          />
        </button>
      }
    >
      <ul className="flex flex-col gap-0.5">
        {lanes.map((lane) => (
          <li key={lane}>
            <button
              type="button"
              onClick={() => {
                onChange(lane);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[11px] font-medium transition ${
                value === lane
                  ? "bg-orange-500/90 text-white"
                  : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
              }`}
            >
              {laneIcon(lane)}
              {CREATION_LANE_LABELS[lane]}
            </button>
          </li>
        ))}
      </ul>
    </CompactDockSheet>
  );
}