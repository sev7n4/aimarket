"use client";

import { Package } from "lucide-react";
import type { AgentSkillPublic } from "@/lib/types";

interface SkillPackagePickerProps {
  skills: AgentSkillPublic[];
  selectedId: string | null;
  disabled?: boolean;
  onSelect: (skillId: string | null) => void;
}

export function SkillPackagePicker({
  skills,
  selectedId,
  disabled = false,
  onSelect,
}: SkillPackagePickerProps) {
  if (skills.length === 0) return null;

  return (
    <div className="mb-2">
      <p className="mb-1.5 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
        <Package className="size-3" />
        一键套餐
      </p>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelect(null)}
          className={`rounded-lg border px-2.5 py-1 text-xs transition ${
            selectedId === null
              ? "border-white/20 bg-white/10 text-zinc-200"
              : "border-white/10 text-zinc-500 hover:border-white/15 hover:text-zinc-300"
          } disabled:opacity-50`}
        >
          即兴 Agent
        </button>
        {skills.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={disabled}
            title={s.description}
            onClick={() => onSelect(s.id)}
            className={`rounded-lg border px-2.5 py-1 text-xs transition ${
              selectedId === s.id
                ? "border-amber-500/40 bg-amber-500/15 text-amber-100"
                : "border-white/10 text-zinc-400 hover:border-amber-500/25 hover:text-zinc-200"
            } disabled:opacity-50`}
          >
            {s.name}
          </button>
        ))}
      </div>
    </div>
  );
}
