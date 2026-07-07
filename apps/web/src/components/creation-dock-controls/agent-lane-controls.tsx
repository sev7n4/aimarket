"use client";

import { useState } from "react";
import {
  Bot,
  ChevronDown,
  Lightbulb,
  Package,
  Sparkles,
} from "lucide-react";
import { CompactDockSheet } from "@/components/compact-dock-sheet";
import {
  OUTPUT_PREF_AUTO_LABEL,
  type OutputPreferenceMode,
} from "@/lib/creation-dock-prefs";
import { DOCK_PILL } from "./shared";
import type { DockSkillOption } from "./constants";

interface AgentOutputPreferencePickerProps {
  mode: OutputPreferenceMode;
  onModeChange: (mode: OutputPreferenceMode) => void;
  disabled?: boolean;
}

export function AgentOutputPreferencePicker({
  mode,
  onModeChange,
  disabled = false,
}: AgentOutputPreferencePickerProps) {
  const [open, setOpen] = useState(false);
  const label = mode === "auto" ? OUTPUT_PREF_AUTO_LABEL : "自定义";

  return (
    <CompactDockSheet
      open={open}
      onClose={() => setOpen(false)}
      title="输出偏好"
      dense
      desktopWidthClass="w-[min(100vw-1.5rem,18rem)]"
      placement="above"
      maxHeight="min(320px,48vh)"
      trigger={
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className={`${DOCK_PILL} disabled:opacity-50`}
          aria-label="输出偏好"
        >
          <Sparkles className="size-3.5 shrink-0 text-orange-400/80" />
          <span className="truncate">{label}</span>
          <ChevronDown
            className={`size-3 shrink-0 opacity-50 transition ${open ? "rotate-180" : ""}`}
          />
        </button>
      }
    >
      <p className="mb-2 text-[10px] leading-relaxed text-zinc-500">
        自动：由 Agent 根据描述智能决定出图或出视频、模型与画幅。
      </p>
      <div className="flex gap-1 rounded-lg bg-white/[0.04] p-0.5">
        <button
          type="button"
          onClick={() => {
            onModeChange("auto");
            setOpen(false);
          }}
          className={`flex-1 rounded-md py-1.5 text-[11px] font-medium transition ${
            mode === "auto"
              ? "bg-white/12 text-zinc-100"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          自动
        </button>
        <button
          type="button"
          onClick={() => {
            onModeChange("manual");
            setOpen(false);
          }}
          className={`flex-1 rounded-md py-1.5 text-[11px] font-medium transition ${
            mode === "manual"
              ? "bg-white/12 text-zinc-100"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          自定义
        </button>
      </div>
      {mode === "manual" ? (
        <p className="mt-2 text-[10px] text-zinc-600">
          切换到「图片生成」或「视频生成」可精细设置模型与画幅。
        </p>
      ) : null}
    </CompactDockSheet>
  );
}

export function DockInspirationButton({
  onClick,
  active = false,
  disabled = false,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`${DOCK_PILL} disabled:opacity-50 ${
        active ? "border-violet-500/35 bg-violet-500/10 text-violet-100" : ""
      }`}
      aria-label="灵感搜索"
      aria-pressed={active}
    >
      <Lightbulb className="size-3.5 shrink-0 text-violet-400/90" />
      <span className="truncate">灵感搜索</span>
    </button>
  );
}

interface SkillDockPickerProps {
  options: DockSkillOption[];
  value: string | null;
  onChange: (skillId: string | null) => void;
  disabled?: boolean;
  /** 即梦 Studio：创意设计；首页：使用技能 */
  triggerLabel?: string;
}

export function SkillDockPicker({
  options,
  value,
  onChange,
  disabled = false,
  triggerLabel = "使用技能",
}: SkillDockPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);
  const label = selected?.name ?? triggerLabel;

  return (
    <CompactDockSheet
      open={open}
      onClose={() => setOpen(false)}
      title={triggerLabel}
      dense
      fitContent
      placement="above"
      maxHeight="min(320px,50vh)"
      trigger={
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className={`${DOCK_PILL} disabled:opacity-50 ${
            value ? "border-amber-500/30 bg-amber-500/10 text-amber-100" : ""
          }`}
          aria-label={triggerLabel}
        >
          <Package className="size-3.5 shrink-0 text-amber-400/90" />
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
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className={`block w-full rounded-md px-2 py-2 text-left text-[11px] font-medium transition ${
              value === null
                ? "bg-white/12 text-zinc-100"
                : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
            }`}
          >
            不使用技能
          </button>
        </li>
        {options.map((opt) => (
          <li key={opt.id}>
            <button
              type="button"
              title={opt.description}
              onClick={() => {
                onChange(opt.id);
                setOpen(false);
              }}
              className={`block w-full rounded-md px-2 py-2 text-left text-[11px] font-medium transition ${
                value === opt.id
                  ? "bg-amber-500/90 text-white"
                  : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
              }`}
            >
              <span className="flex items-center gap-2">
                {opt.name}
                {opt.badge ? (
                  <span className="rounded bg-white/15 px-1 py-0.5 text-[9px] font-normal uppercase">
                    {opt.badge}
                  </span>
                ) : null}
              </span>
              {opt.description ? (
                <span className="mt-0.5 block text-[10px] font-normal text-zinc-500">
                  {opt.description}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </CompactDockSheet>
  );
}