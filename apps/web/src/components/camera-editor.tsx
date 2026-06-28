"use client";

import { useState, useMemo } from "react";
import { Camera, MoveVertical, MoveHorizontal, Eye, Check, X } from "lucide-react";

/** 摄像机状态 */
export interface CameraState {
  /** 俯仰角 -45 到 45 度 */
  tilt: number;
  /** 水平角 -90 到 90 度 */
  pan: number;
  /** 景别/焦距 */
  fov: "close-up" | "close-shot" | "medium" | "full" | "wide";
}

/** 景别选项 */
const FOV_OPTIONS: Array<{ value: CameraState["fov"]; label: string; focal: string }> = [
  { value: "close-up", label: "特写", focal: "10mm" },
  { value: "close-shot", label: "近景", focal: "24mm" },
  { value: "medium", label: "中景", focal: "35mm" },
  { value: "full", label: "全景", focal: "50mm" },
  { value: "wide", label: "远景", focal: "85mm" },
];

const DEFAULT_CAMERA: CameraState = {
  tilt: 0,
  pan: 0,
  fov: "medium",
};

interface CameraEditorProps {
  /** 初始摄像机状态 */
  initial?: Partial<CameraState>;
  /** 确认回调 */
  onConfirm: (camera: CameraState) => void;
  /** 取消回调 */
  onCancel: () => void;
}

/**
 * 摄像机控制 UI：叠加在选中图片上的半透明控制层，
 * 提供俯仰角/水平角/景别三个滑块与方向指示器。
 */
export function CameraEditor({
  initial,
  onConfirm,
  onCancel,
}: CameraEditorProps) {
  const [tilt, setTilt] = useState(initial?.tilt ?? DEFAULT_CAMERA.tilt);
  const [pan, setPan] = useState(initial?.pan ?? DEFAULT_CAMERA.pan);
  const [fov, setFov] = useState(initial?.fov ?? DEFAULT_CAMERA.fov);

  /** 方向指示器箭头旋转角度 */
  const arrowRotation = useMemo(() => {
    // 组合 tilt 和 pan 计算综合方向角
    return Math.atan2(pan, -tilt) * (180 / Math.PI);
  }, [tilt, pan]);

  /** 方向指示器偏移 */
  const arrowOffset = useMemo(() => {
    const maxShift = 20;
    const panNorm = pan / 90;
    const tiltNorm = tilt / 45;
    return {
      x: panNorm * maxShift,
      y: -tiltNorm * maxShift,
    };
  }, [pan, tilt]);

  function handleConfirm() {
    onConfirm({ tilt, pan, fov });
  }

  const tiltLabel =
    tilt < -20 ? "仰拍" : tilt < -5 ? "轻微仰拍" : tilt > 20 ? "俯拍" : tilt > 5 ? "轻微俯拍" : "平拍";

  const panLabel =
    pan < -45 ? "左侧" : pan < -10 ? "略偏左" : pan > 45 ? "右侧" : pan > 10 ? "略偏右" : "正面";

  return (
    <div className="absolute inset-0 z-20 touch-none">
      {/* 半透明遮罩 */}
      <div className="absolute inset-0 bg-black/40" />

      {/* 方向指示器 */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative">
          {/* 十字参考线 */}
          <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/20" />
          <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/20" />
          {/* 方向箭头 */}
          <div
            className="flex size-16 items-center justify-center rounded-full border-2 border-sky-400/60 bg-sky-500/20 backdrop-blur-sm transition-transform duration-150"
            style={{
              transform: `translate(${arrowOffset.x}px, ${arrowOffset.y}px)`,
            }}
          >
            <div
              className="transition-transform duration-150"
              style={{ transform: `rotate(${arrowRotation}deg)` }}
            >
              <Camera className="size-6 text-sky-300" />
            </div>
          </div>
          {/* 当前角度提示 */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/70 px-2 py-0.5 text-[10px] text-zinc-300">
            {tiltLabel} · {panLabel}
          </div>
        </div>
      </div>

      {/* 底部控制面板 */}
      <div className="absolute bottom-0 left-0 right-0">
        <div className="mx-auto max-w-sm rounded-t-xl border-t border-x border-white/10 bg-black/85 px-4 py-3 backdrop-blur-md">
          {/* 俯仰角 */}
          <SliderRow
            icon={<MoveVertical className="size-3.5" />}
            label="俯仰角"
            value={tilt}
            min={-45}
            max={45}
            step={1}
            displayValue={`${tilt}°`}
            onChange={setTilt}
          />

          {/* 水平角 */}
          <SliderRow
            icon={<MoveHorizontal className="size-3.5" />}
            label="水平角"
            value={pan}
            min={-90}
            max={90}
            step={1}
            displayValue={`${pan}°`}
            onChange={setPan}
          />

          {/* 景别 */}
          <div className="mb-3 flex items-center gap-2">
            <Eye className="size-3.5 shrink-0 text-zinc-400" />
            <span className="shrink-0 text-[11px] text-zinc-400 w-8">景别</span>
            <div className="flex flex-1 gap-1">
              {FOV_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFov(opt.value)}
                  className={`flex-1 rounded px-1 py-1 text-[10px] transition ${
                    fov === opt.value
                      ? "bg-sky-500 text-white"
                      : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                  }`}
                >
                  <span className="block">{opt.label}</span>
                  <span className="block text-[8px] opacity-60">{opt.focal}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 确认/取消 */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-white/10 px-3 py-2 text-xs text-zinc-300 transition hover:bg-white/15"
            >
              <X className="size-3" />
              取消
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-sky-500 px-3 py-2 text-xs font-medium text-white transition hover:bg-sky-400"
            >
              <Check className="size-3" />
              确认
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 滑块行 */
function SliderRow({
  icon,
  label,
  value,
  min,
  max,
  step,
  displayValue,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  displayValue: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <span className="shrink-0 text-zinc-400">{icon}</span>
      <span className="shrink-0 text-[11px] text-zinc-400 w-8">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="flex-1 accent-sky-400"
      />
      <span className="shrink-0 w-8 text-right text-[11px] tabular-nums text-zinc-300">
        {displayValue}
      </span>
    </div>
  );
}
