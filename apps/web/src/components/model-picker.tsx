"use client";

import { useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import type { ImageModel, VideoModelRouteMeta } from "@/lib/types";
import type { VideoReferenceMode } from "@/lib/creation-dock-prefs";
import { CompactDockSheet } from "@/components/compact-dock-sheet";
import { isInternalRoutingModelId } from "@/lib/format-generation-display";

export const AUTO_MODEL_ID = "auto";

function capabilityHint(
  route: VideoModelRouteMeta | undefined,
  referenceMode?: VideoReferenceMode,
): string | undefined {
  if (!route?.capabilities || !referenceMode) return undefined;
  const c = route.capabilities;
  if (referenceMode === "omni") {
    if (c.omni === "image-only") return "此模式下将降级为仅首图";
    if (c.omni === "none") return "不支持全能参考";
  }
  if (referenceMode === "first-last") {
    if (c.firstLast === "first-only") return "此模式下将降级为仅首帧";
    if (c.firstLast === "none") return "不支持首尾帧";
  }
  if (referenceMode === "smart-multi-frame") {
    if (c.smartMultiFrame === "degraded") return "此模式下将合并 prompt + 首图";
    if (c.smartMultiFrame === "none") return "不支持智能多帧";
  }
  return undefined;
}

interface ModelPickerProps {
  models: ImageModel[];
  value: string;
  onChange: (id: string) => void;
  /** 选中 Auto 时在按钮上显示的补充说明，如「Auto · Agnes Video」 */
  autoLabel?: string;
  /** 视频模型路由（可用性 / 代理说明） */
  videoRoutes?: VideoModelRouteMeta[];
  referenceMode?: VideoReferenceMode;
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

export function ModelPicker({
  models,
  value,
  onChange,
  autoLabel,
  videoRoutes,
  referenceMode,
}: ModelPickerProps) {
  const [open, setOpen] = useState(false);

  const list = models;

  const selectedVideoRoute =
    value !== AUTO_MODEL_ID && !isInternalRoutingModelId(value)
      ? videoRoutes?.find((r) => r.modelId === value)
      : undefined;

  const modeHint = capabilityHint(selectedVideoRoute, referenceMode);

  const label =
    value === AUTO_MODEL_ID || isInternalRoutingModelId(value)
      ? autoLabel
        ? `Auto · ${autoLabel}`
        : "Auto"
      : selectedVideoRoute?.routingHint
        ? `${list.find((m) => m.id === value)?.name ?? "选择模型"} · ${selectedVideoRoute.routingHint}`
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
          title={modeHint}
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
            {autoLabel ? `Auto · ${autoLabel}` : "Auto"}
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
            {videoModels.map((m) => {
              const route = videoRoutes?.find((r) => r.modelId === m.id);
              const disabled = route?.available === false;
              const hint = capabilityHint(route, referenceMode);
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    title={
                      disabled
                        ? route?.unavailableReason
                        : hint ?? route?.upstreamLabel
                    }
                    onClick={() => pick(m.id)}
                    className={`${modelOptionClass(value === m.id)} ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
                  >
                    <span className="block truncate">{m.name}</span>
                    {route?.routingHint ? (
                      <span className="block truncate text-[9px] font-normal opacity-70">
                        {route.routingHint}
                      </span>
                    ) : null}
                    {hint ? (
                      <span className="block truncate text-[9px] font-normal text-amber-400/90">
                        {hint}
                      </span>
                    ) : null}
                    {disabled && route?.unavailableReason ? (
                      <span className="block truncate text-[9px] font-normal text-amber-500/90">
                        未接入
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </CompactDockSheet>
  );
}
