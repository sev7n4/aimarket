"use client";

import { useCallback, useRef } from "react";
import { Lightbulb, X, Trash2 } from "lucide-react";
import { randomUUID } from "@/lib/uuid";

/* ── 类型定义 ── */

export interface LightSource {
  id: string;
  /** 归一化 X 坐标 0-1 */
  x: number;
  /** 归一化 Y 坐标 0-1 */
  y: number;
  /** 色温 */
  colorTemp: "warm-white" | "cool-white" | "warm-yellow";
  /** 强度 0-1 */
  intensity: number;
  /** 光源类型 */
  lightType: "point" | "area" | "spot";
}

export interface LightingState {
  lights: LightSource[];
  activeLightId: string | null;
}

/* ── 常量 ── */

const MAX_LIGHTS = 5;

const COLOR_TEMP_OPTIONS = [
  { value: "warm-white" as const, label: "暖白", color: "#fef3c7" },
  { value: "cool-white" as const, label: "冷白", color: "#e0f2fe" },
  { value: "warm-yellow" as const, label: "暖黄", color: "#fde68a" },
];

const LIGHT_TYPE_OPTIONS = [
  { value: "point" as const, label: "点光" },
  { value: "area" as const, label: "面光" },
  { value: "spot" as const, label: "聚光" },
];

/* ── 工具函数 ── */

function createLight(x: number, y: number): LightSource {
  return {
    id: `light_${randomUUID().replace(/-/g, "").slice(0, 10)}`,
    x,
    y,
    colorTemp: "warm-white",
    intensity: 0.8,
    lightType: "point",
  };
}

/* ── 光源参数面板 ── */

interface LightParamsPanelProps {
  light: LightSource;
  onColorTempChange: (v: LightSource["colorTemp"]) => void;
  onIntensityChange: (v: number) => void;
  onLightTypeChange: (v: LightSource["lightType"]) => void;
  onDelete: () => void;
  onClose: () => void;
}

function LightParamsPanel({
  light,
  onColorTempChange,
  onIntensityChange,
  onLightTypeChange,
  onDelete,
  onClose,
}: LightParamsPanelProps) {
  return (
    <div
      className="absolute bottom-2 left-1/2 z-30 -translate-x-1/2 rounded-xl border border-amber-400/25 bg-black/90 p-3 shadow-lg backdrop-blur-sm"
      style={{ minWidth: 260 }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 标题栏 */}
      <div className="mb-2 flex items-center gap-1.5">
        <Lightbulb className="size-3.5 text-amber-300" />
        <span className="text-[11px] font-medium text-amber-200">光源参数</span>
        <button
          type="button"
          onClick={onDelete}
          className="ml-auto flex items-center gap-0.5 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-red-300 hover:bg-red-500/20 hover:text-red-200"
          title="删除光源"
        >
          <Trash2 className="size-3" />
          删除
        </button>
        <button
            type="button"
            onClick={onClose}
            className="rounded-full p-0.5 text-zinc-400 hover:text-zinc-200"
            title="关闭面板"
          >
          <X className="size-3" />
        </button>
      </div>

      {/* 色温选择 */}
      <div className="mb-2.5">
        <p className="mb-1 text-[10px] text-zinc-400">色温</p>
        <div className="flex gap-1.5">
          {COLOR_TEMP_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onColorTempChange(opt.value)}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] transition ${
                light.colorTemp === opt.value
                  ? "ring-1 ring-amber-400/60 bg-amber-500/20 text-amber-100"
                  : "bg-white/5 text-zinc-500 hover:bg-white/10 hover:text-zinc-300"
              }`}
            >
              <span
                className="inline-block size-2.5 rounded-full border border-white/20"
                style={{ backgroundColor: opt.color }}
              />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 强度滑块 */}
      <div className="mb-2.5">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-[10px] text-zinc-400">强度</p>
          <span className="text-[10px] text-zinc-300">
            {Math.round(light.intensity * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(light.intensity * 100)}
          onChange={(e) => onIntensityChange(Number(e.target.value) / 100)}
          className="w-full accent-amber-400"
          title="光源强度"
        />
      </div>

      {/* 类型选择 */}
      <div>
        <p className="mb-1 text-[10px] text-zinc-400">类型</p>
        <div className="flex gap-1.5">
          {LIGHT_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onLightTypeChange(opt.value)}
              className={`rounded-full px-2.5 py-1 text-[10px] transition ${
                light.lightType === opt.value
                  ? "bg-amber-500/30 text-amber-100 ring-1 ring-amber-400/50"
                  : "bg-white/5 text-zinc-500 hover:bg-white/10 hover:text-zinc-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── 主组件 ── */

interface LightingEditorProps {
  /** 当前灯光状态 */
  value: LightingState;
  /** 灯光状态变更回调 */
  onChange: (state: LightingState) => void;
  /** 取消编辑 */
  onCancel: () => void;
  /** 确认完成 */
  onComplete: () => void;
}

export function LightingEditor({
  value,
  onChange,
  onCancel,
  onComplete,
}: LightingEditorProps) {
  const { lights, activeLightId } = value;
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    lightId: string;
    startX: number;
    startY: number;
    startNormX: number;
    startNormY: number;
  } | null>(null);

  const activeLight = lights.find((l) => l.id === activeLightId) ?? null;

  /** 点击空白处添加光源 */
  const handleContainerClick = useCallback(
    (e: React.MouseEvent) => {
      // 如果点击的是光源点或面板，不添加
      const target = e.target as HTMLElement;
      if (target.closest("[data-light-id]") || target.closest("[data-params-panel]")) return;

      if (lights.length >= MAX_LIGHTS) return;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

      const newLight = createLight(x, y);
      onChange({
        lights: [...lights, newLight],
        activeLightId: newLight.id,
      });
    },
    [lights, onChange],
  );

  /** 点击光源点选中 */
  const handleLightClick = useCallback(
    (e: React.MouseEvent, lightId: string) => {
      e.stopPropagation();
      onChange({ ...value, activeLightId: lightId });
    },
    [value, onChange],
  );

  /** 拖拽光源移动 */
  const handleLightPointerDown = useCallback(
    (e: React.PointerEvent, lightId: string) => {
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

      const light = lights.find((l) => l.id === lightId);
      if (!light) return;

      dragRef.current = {
        lightId,
        startX: e.clientX,
        startY: e.clientY,
        startNormX: light.x,
        startNormY: light.y,
      };
    },
    [lights],
  );

  const handleLightPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const dx = (e.clientX - drag.startX) / rect.width;
      const dy = (e.clientY - drag.startY) / rect.height;
      const nx = Math.max(0, Math.min(1, drag.startNormX + dx));
      const ny = Math.max(0, Math.min(1, drag.startNormY + dy));

      onChange({
        ...value,
        lights: value.lights.map((l) =>
          l.id === drag.lightId ? { ...l, x: nx, y: ny } : l,
        ),
      });
    },
    [value, onChange],
  );

  const handleLightPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  /** 更新选中光源属性 */
  const updateActiveLight = useCallback(
    (patch: Partial<LightSource>) => {
      if (!activeLightId) return;
      onChange({
        ...value,
        lights: value.lights.map((l) =>
          l.id === activeLightId ? { ...l, ...patch } : l,
        ),
      });
    },
    [value, onChange, activeLightId],
  );

  /** 删除选中光源 */
  const deleteActiveLight = useCallback(() => {
    if (!activeLightId) return;
    onChange({
      lights: value.lights.filter((l) => l.id !== activeLightId),
      activeLightId: null,
    });
  }, [value, onChange, activeLightId]);

  /** 获取光源对应的色温颜色 */
  const getLightColor = (colorTemp: LightSource["colorTemp"]): string => {
    const map: Record<LightSource["colorTemp"], string> = {
      "warm-white": "#fef3c7",
      "cool-white": "#e0f2fe",
      "warm-yellow": "#fde68a",
    };
    return map[colorTemp];
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-20 touch-none"
      onClick={handleContainerClick}
      onPointerMove={handleLightPointerMove}
      onPointerUp={handleLightPointerUp}
      onPointerCancel={handleLightPointerUp}
    >
      {/* 半透明遮罩 */}
      <div className="absolute inset-0 bg-amber-500/5" aria-hidden />

      {/* 顶部工具栏 */}
      <div className="pointer-events-none absolute -top-10 left-0 right-0 flex justify-center">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-amber-400/30 bg-black/85 px-2 py-1 shadow-lg backdrop-blur">
          <Lightbulb className="size-3 text-amber-300" />
          <span className="text-[10px] text-amber-200">灯光控制</span>
          <span className="text-[10px] text-zinc-500">
            {lights.length}/{MAX_LIGHTS}
          </span>
          <button
            type="button"
            onClick={onComplete}
            className="ml-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-medium text-white"
          >
            确认
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-zinc-400"
          >
            取消
          </button>
        </div>
      </div>

      {/* 光源点 */}
      {lights.map((light) => {
        const isActive = light.id === activeLightId;
        return (
          <div
            key={light.id}
            data-light-id={light.id}
            className={`absolute z-20 flex size-6 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full border-2 shadow-md transition-shadow active:cursor-grabbing ${
              isActive
                ? "border-amber-300 shadow-amber-400/50 shadow-lg"
                : "border-white/60 shadow-black/30 hover:border-amber-300/80"
            }`}
            style={{
              left: `${light.x * 100}%`,
              top: `${light.y * 100}%`,
              backgroundColor: getLightColor(light.colorTemp),
            }}
            onClick={(e) => handleLightClick(e, light.id)}
            onPointerDown={(e) => handleLightPointerDown(e, light.id)}
          >
            {/* 选中时显示删除按钮 */}
            {isActive && (
              <button
                type="button"
                title="删除光源"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteActiveLight();
                }}
                className="absolute -right-2 -top-2 flex size-4 items-center justify-center rounded-full bg-red-500 text-white shadow"
              >
                <X className="size-2.5" />
              </button>
            )}
          </div>
        );
      })}

      {/* 参数面板 */}
      {activeLight && (
        <div data-params-panel>
          <LightParamsPanel
            light={activeLight}
            onColorTempChange={(v) => updateActiveLight({ colorTemp: v })}
            onIntensityChange={(v) => updateActiveLight({ intensity: v })}
            onLightTypeChange={(v) => updateActiveLight({ lightType: v })}
            onDelete={deleteActiveLight}
            onClose={() => onChange({ ...value, activeLightId: null })}
          />
        </div>
      )}

      {/* 空状态提示 */}
      {lights.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="rounded-lg bg-black/60 px-3 py-1.5 text-[11px] text-zinc-400">
            点击图片添加光源（最多 {MAX_LIGHTS} 个）
          </p>
        </div>
      )}
    </div>
  );
}
