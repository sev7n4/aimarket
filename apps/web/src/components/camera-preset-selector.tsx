"use client";

import { useState } from "react";
import { Check, Camera } from "lucide-react";

/** 运镜预设数据（与后端 camera-presets.ts 对应） */
export interface CameraPresetItem {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  camera: { tilt: number; pan: number; fov: string };
  promptSuffix: string;
}

interface CameraPresetSelectorProps {
  /** 预设列表，从后端 API 获取或硬编码 */
  presets: CameraPresetItem[];
  /** 当前选中的预设 ID */
  selectedId?: string;
  /** 选择预设回调 */
  onSelect?: (preset: CameraPresetItem) => void;
  /** 应用运镜按钮回调 */
  onApply?: (preset: CameraPresetItem) => void;
}

/**
 * 运镜预设选择器 UI
 *
 * 网格布局显示 12 个运镜预设，
 * 每个预设显示名称 + 简短描述，
 * 点击选择后高亮，应用到摄像机控制参数。
 */
export function CameraPresetSelector({
  presets,
  selectedId,
  onSelect,
  onApply,
}: CameraPresetSelectorProps) {
  const [internalSelected, setInternalSelected] = useState<string | undefined>(selectedId);

  const selected = internalSelected ?? selectedId;
  const selectedPreset = presets.find((p) => p.id === selected);

  function handleSelect(preset: CameraPresetItem) {
    setInternalSelected(preset.id);
    onSelect?.(preset);
  }

  function handleApply() {
    if (selectedPreset) {
      onApply?.(selectedPreset);
    }
  }

  return (
    <div className="space-y-3">
      {/* 预设网格 */}
      <div className="grid grid-cols-3 gap-2">
        {presets.map((preset) => {
          const isActive = selected === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleSelect(preset)}
              className={`group relative flex flex-col items-start rounded-lg border px-3 py-2.5 text-left transition
                ${isActive
                  ? "border-violet-500/60 bg-violet-500/10 shadow-sm shadow-violet-500/20"
                  : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
                }`}
            >
              {/* 选中标记 */}
              {isActive && (
                <div className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-violet-500">
                  <Check className="size-2.5 text-white" />
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <Camera className={`size-3 ${isActive ? "text-violet-400" : "text-zinc-500"}`} />
                <span className={`text-xs font-medium ${isActive ? "text-violet-300" : "text-zinc-300"}`}>
                  {preset.name}
                </span>
              </div>
              <span className="mt-0.5 text-[10px] text-zinc-500">{preset.nameEn}</span>
              <span className="mt-1 line-clamp-2 text-[10px] leading-tight text-zinc-600">
                {preset.description}
              </span>
            </button>
          );
        })}
      </div>

      {/* 选中预设详情 + 应用按钮 */}
      {selectedPreset && (
        <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-violet-300">
                {selectedPreset.name}
              </span>
              <span className="ml-2 text-xs text-zinc-500">
                {selectedPreset.nameEn}
              </span>
            </div>
            <button
              type="button"
              onClick={handleApply}
              className="flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-500"
            >
              <Camera className="size-3" />
              应用运镜
            </button>
          </div>
          <p className="mt-1 text-[11px] text-zinc-400">
            {selectedPreset.promptSuffix}
          </p>
          <div className="mt-2 flex gap-3 text-[10px] text-zinc-600">
            <span>俯仰 {selectedPreset.camera.tilt}°</span>
            <span>水平 {selectedPreset.camera.pan}°</span>
            <span>景别 {selectedPreset.camera.fov}</span>
          </div>
        </div>
      )}
    </div>
  );
}
