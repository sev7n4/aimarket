"use client";

import React, { useCallback } from "react";

import { canvasTheme } from "../canvas-theme";

export type CameraParams = {
  /** 景别: 远景/全景/中景/近景/特写 */
  shotSize?: string;
  /** 运镜: 推/拉/摇/移/跟/固定 */
  movement?: string;
  /** 俯仰: -45 to 45 degrees */
  pitch?: number;
  /** 水平: -180 to 180 degrees */
  yaw?: number;
};

export type CameraOverlayProps = {
  params?: CameraParams;
  onChange?: (params: CameraParams) => void;
  className?: string;
};

const SHOT_SIZES = [
  { label: "超远", value: "超远景", desc: "ELS" },
  { label: "远景", value: "远景", desc: "LS" },
  { label: "全景", value: "全景", desc: "WS" },
  { label: "中景", value: "中景", desc: "MS" },
  { label: "近景", value: "近景", desc: "CU" },
  { label: "特写", value: "特写", desc: "ECU" },
];

const MOVEMENTS = [
  { label: "固定", value: "固定" },
  { label: "推", value: "推进" },
  { label: "拉", value: "拉远" },
  { label: "摇", value: "摇镜" },
  { label: "移", value: "横移" },
  { label: "跟", value: "跟拍" },
];

function Slider({
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px]" style={{ color: canvasTheme.node.faint }}>{label}</span>
        <span className="text-[10px] font-mono text-white">{value}{unit}</span>
      </div>
      <div className="relative h-1.5 cursor-pointer rounded-full" style={{ background: "rgba(255,255,255,0.1)" }}>
        <div
          className="absolute h-full rounded-full"
          style={{ width: `${pct}%`, background: "#6366f1" }}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label={label}
        />
      </div>
    </div>
  );
}

export function CameraOverlay({ params = {}, onChange, className }: CameraOverlayProps) {
  const { shotSize, movement, pitch = 0, yaw = 0 } = params;

  const update = useCallback(
    (patch: Partial<CameraParams>) => {
      onChange?.({ ...params, ...patch });
    },
    [params, onChange],
  );

  // Encode to camera prompt string
  const cameraPrompt = [
    shotSize ? `景别：${shotSize}` : null,
    movement ? `运镜：${movement}` : null,
    pitch !== 0 ? `俯仰：${pitch > 0 ? "+" : ""}${pitch}°` : null,
    yaw !== 0 ? `水平：${yaw > 0 ? "+" : ""}${yaw}°` : null,
  ]
    .filter(Boolean)
    .join("，");

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl p-3 ${className || ""}`}
      style={{ background: "rgba(0,0,0,0.85)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-white">摄影机参数</span>
        {cameraPrompt && (
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(cameraPrompt)}
            className="text-[9px] text-indigo-400 hover:text-indigo-300"
            title="复制摄影参数"
          >
            复制
          </button>
        )}
      </div>

      {/* Shot size */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px]" style={{ color: canvasTheme.node.faint }}>景别</span>
        <div className="flex flex-wrap gap-1">
          {SHOT_SIZES.map(({ label, value, desc }) => (
            <button
              key={value}
              type="button"
              onClick={() => update({ shotSize: value })}
              className="flex flex-col items-center rounded-lg px-2 py-1 transition-all"
              style={{
                background: shotSize === value ? "#6366f1" : "rgba(255,255,255,0.08)",
                color: shotSize === value ? "#fff" : canvasTheme.node.faint,
              }}
            >
              <span className="text-[9px] font-medium">{label}</span>
              <span className="text-[8px] opacity-60">{desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Movement */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px]" style={{ color: canvasTheme.node.faint }}>运镜</span>
        <div className="flex flex-wrap gap-1">
          {MOVEMENTS.map(({ label, value }) => (
            <button
              key={value}
              type="button"
              onClick={() => update({ movement: value })}
              className="rounded-lg px-2 py-0.5 text-[10px] transition-all"
              style={{
                background: movement === value ? "#f59e0b" : "rgba(255,255,255,0.08)",
                color: movement === value ? "#000" : canvasTheme.node.faint,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Angle sliders */}
      <div className="flex flex-col gap-2">
        <Slider
          label="俯仰"
          value={pitch}
          min={-45}
          max={45}
          unit="°"
          onChange={(v) => update({ pitch: v })}
        />
        <Slider
          label="水平"
          value={yaw}
          min={-180}
          max={180}
          unit="°"
          onChange={(v) => update({ yaw: v })}
        />
      </div>

      {/* Prompt preview */}
      {cameraPrompt && (
        <div
          className="rounded-lg p-2 text-[10px] leading-relaxed"
          style={{ background: "rgba(99,102,241,0.15)", color: canvasTheme.node.muted }}
        >
          {cameraPrompt}
        </div>
      )}
    </div>
  );
}
