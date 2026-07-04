"use client";

import { useEffect, useState } from "react";
import { fetchDramaVoices } from "@/lib/api-client";
import type { DramaVoiceOption } from "@/lib/types";

interface DramaVoicePickerProps {
  value?: string;
  disabled?: boolean;
  onChange: (voiceId: string) => void;
}

/** 角色旁白 / 对白音色选择 */
export function DramaVoicePicker({
  value,
  disabled,
  onChange,
}: DramaVoicePickerProps) {
  const [options, setOptions] = useState<DramaVoiceOption[]>([]);

  useEffect(() => {
    void fetchDramaVoices()
      .then(setOptions)
      .catch(() => setOptions([]));
  }, []);

  if (options.length === 0) return null;

  return (
    <label className="flex flex-col gap-1" data-testid="drama-voice-picker">
      <span className="text-[10px] text-zinc-500">旁白音色</span>
      <select
        value={value ?? options[0]?.id ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-white/10 bg-black/40 px-2 py-1 text-[11px] text-zinc-200 disabled:opacity-50"
      >
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label} · {opt.description}
          </option>
        ))}
      </select>
    </label>
  );
}
