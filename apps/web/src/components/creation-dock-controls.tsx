"use client";

import { useMemo, useState } from "react";
import {
  Bot,
  ChevronDown,
  Clapperboard,
  ImageIcon,
  Lightbulb,
  Package,
  Sparkles,
  Timer,
  Video,
} from "lucide-react";
import { CompactDockSheet } from "@/components/compact-dock-sheet";
import { ModelPicker, AUTO_MODEL_ID } from "@/components/model-picker";
import { CountPicker } from "@/components/count-picker";
import {
  GenerationSettingsPopover,
  type AspectRatio,
} from "@/components/generation-settings-popover";
import type { AgentSkillPublic, ImageModel, VideoModelRouteMeta } from "@/lib/types";
import {
  CREATION_LANE_LABELS,
  OUTPUT_PREF_AUTO_LABEL,
  VIDEO_REFERENCE_LABELS,
  type CreationLane,
  type OutputPreferenceMode,
  type VideoDurationSec,
  type VideoReferenceMode,
  type VideoResolution,
} from "@/lib/creation-dock-prefs";
import {
  VideoOutputSettings,
  applyModeVideoSettings,
} from "@/components/video-output-settings";

const DOCK_PILL =
  "inline-flex max-w-[11rem] shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-zinc-300 transition hover:border-white/15 hover:bg-white/[0.07] hover:text-zinc-100";

/** 历史 Dock 存盘别名；新逻辑统一为 Skill `ecommerce-set-v1` */
export const ECOMMERCE_DOCK_SKILL_ID = "__ecommerce__";
export const ECOMMERCE_SET_SKILL_ID = "ecommerce-set-v1";
/** AI 短剧（独立 /drama API，借鉴 RHTV Anchor First） */
export const DRAMA_SKILL_ID = "drama-short-v1";

export function normalizeDockSkillId(id: string | null): string | null {
  if (!id) return null;
  if (id === ECOMMERCE_DOCK_SKILL_ID) return ECOMMERCE_SET_SKILL_ID;
  return id;
}

function laneIcon(lane: CreationLane) {
  if (lane === "agent") {
    return <Bot className="size-3.5 shrink-0 text-violet-400/90" />;
  }
  if (lane === "video") {
    return <Video className="size-3.5 shrink-0 text-sky-400/90" />;
  }
  return <ImageIcon className="size-3.5 shrink-0 text-orange-400/90" />;
}

// —— 创作方式（三种模式均有，文案随当前模式变化）——

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

// —— Agent 模式：自动 + 灵感搜索（可选）+ 使用技能 ——

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

export interface DockSkillOption {
  id: string;
  name: string;
  description?: string;
  badge?: string;
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

// —— 图片模式：模型 + 比例分辨率 + 张数 ——

interface ImageDockSettingsProps {
  models: ImageModel[];
  modelId: string;
  onModelChange: (id: string) => void;
  count: number;
  onCountChange: (n: number) => void;
  resolution: string;
  aspectRatio: AspectRatio;
  onResolutionChange: (v: string) => void;
  onAspectRatioChange: (v: AspectRatio) => void;
  disabled?: boolean;
}

export function ImageDockSettings({
  models,
  modelId,
  onModelChange,
  count,
  onCountChange,
  resolution,
  aspectRatio,
  onResolutionChange,
  onAspectRatioChange,
  disabled = false,
}: ImageDockSettingsProps) {
  const imageModels = models.filter((m) => m.type === "image");

  return (
    <>
      <div className={disabled ? "pointer-events-none opacity-50" : undefined}>
        <ModelPicker
          models={imageModels.length ? imageModels : models}
          value={modelId}
          onChange={onModelChange}
        />
      </div>
      <div className={disabled ? "pointer-events-none opacity-50" : undefined}>
        <GenerationSettingsPopover
          mode="chat"
          resolution={resolution}
          aspectRatio={aspectRatio}
          onResolutionChange={onResolutionChange}
          onAspectRatioChange={onAspectRatioChange}
        />
      </div>
      <div className={disabled ? "pointer-events-none opacity-50" : undefined}>
        <CountPicker value={count} onChange={onCountChange} max={4} />
      </div>
    </>
  );
}

// —— 视频模式：模型 + 全能参考 + 画幅 + 时长 ——

interface VideoReferencePickerProps {
  value: VideoReferenceMode;
  onChange: (mode: VideoReferenceMode) => void;
  disabled?: boolean;
}

export function VideoReferencePicker({
  value,
  onChange,
  disabled = false,
}: VideoReferencePickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <CompactDockSheet
      open={open}
      onClose={() => setOpen(false)}
      title="参考方式"
      dense
      fitContent
      placement="above"
      maxHeight="min(240px,40vh)"
      trigger={
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className={`${DOCK_PILL} disabled:opacity-50`}
          aria-label="视频参考方式"
        >
          <Clapperboard className="size-3.5 shrink-0 text-sky-400/80" />
          <span className="truncate">{VIDEO_REFERENCE_LABELS[value]}</span>
          <ChevronDown
            className={`size-3 shrink-0 opacity-50 transition ${open ? "rotate-180" : ""}`}
          />
        </button>
      }
    >
      <ul className="flex flex-col gap-0.5">
        {(Object.keys(VIDEO_REFERENCE_LABELS) as VideoReferenceMode[]).map(
          (mode) => (
            <li key={mode}>
              <button
                type="button"
                onClick={() => {
                  onChange(mode);
                  setOpen(false);
                }}
                className={`block w-full rounded-md px-2 py-2 text-left text-[11px] font-medium transition ${
                  value === mode
                    ? "bg-sky-500/90 text-white"
                    : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                }`}
              >
                {VIDEO_REFERENCE_LABELS[mode]}
              </button>
            </li>
          ),
        )}
      </ul>
    </CompactDockSheet>
  );
}

interface VideoDurationPickerProps {
  value: VideoDurationSec;
  onChange: (sec: VideoDurationSec) => void;
  disabled?: boolean;
}

export function VideoDurationPicker({
  value,
  onChange,
  disabled = false,
}: VideoDurationPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <CompactDockSheet
      open={open}
      onClose={() => setOpen(false)}
      title="时长"
      dense
      fitContent
      placement="above"
      maxHeight="min(200px,36vh)"
      trigger={
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className={`${DOCK_PILL} max-w-[4.5rem] disabled:opacity-50`}
          aria-label="视频时长"
        >
          <Timer className="size-3.5 shrink-0 text-zinc-400" />
          <span className="truncate">{value}s</span>
          <ChevronDown
            className={`size-3 shrink-0 opacity-50 transition ${open ? "rotate-180" : ""}`}
          />
        </button>
      }
    >
      <ul className="flex flex-col gap-0.5">
        {([5, 10] as const).map((sec) => (
          <li key={sec}>
            <button
              type="button"
              onClick={() => {
                onChange(sec);
                setOpen(false);
              }}
              className={`block w-full rounded-md px-2 py-2 text-left text-[11px] font-medium transition ${
                value === sec
                  ? "bg-sky-500/90 text-white"
                  : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
              }`}
            >
              {sec} 秒
            </button>
          </li>
        ))}
      </ul>
    </CompactDockSheet>
  );
}

interface VideoDockSettingsProps {
  models: ImageModel[];
  modelId: string;
  onModelChange: (id: string) => void;
  aspectRatio: AspectRatio;
  onAspectRatioChange: (v: AspectRatio) => void;
  referenceMode: VideoReferenceMode;
  onReferenceModeChange: (mode: VideoReferenceMode) => void;
  durationSec: VideoDurationSec;
  onDurationSecChange: (sec: VideoDurationSec) => void;
  videoResolution: VideoResolution;
  onVideoResolutionChange: (v: VideoResolution) => void;
  smartMultiShotCount?: number;
  videoAutoLabel?: string;
  videoRoutes?: VideoModelRouteMeta[];
  disabled?: boolean;
}

export function VideoDockSettings({
  models,
  modelId,
  onModelChange,
  aspectRatio,
  onAspectRatioChange,
  referenceMode,
  onReferenceModeChange,
  durationSec,
  onDurationSecChange,
  videoResolution,
  onVideoResolutionChange,
  smartMultiShotCount = 2,
  videoAutoLabel,
  videoRoutes,
  disabled = false,
}: VideoDockSettingsProps) {
  const videoModels = models.filter((m) => m.type === "video");

  function handleReferenceModeChange(mode: VideoReferenceMode) {
    const coerced = applyModeVideoSettings(mode, {
      aspectRatio,
      videoResolution,
      videoDurationSec: durationSec,
    }, smartMultiShotCount);
    onReferenceModeChange(mode);
    onAspectRatioChange(coerced.aspectRatio as AspectRatio);
    onVideoResolutionChange(coerced.videoResolution);
    onDurationSecChange(coerced.videoDurationSec);
  }

  return (
    <>
      <div className={disabled ? "pointer-events-none opacity-50" : undefined}>
        <ModelPicker
          models={videoModels.length ? videoModels : models}
          value={modelId}
          onChange={onModelChange}
          autoLabel={videoAutoLabel}
          videoRoutes={videoRoutes}
          referenceMode={referenceMode}
        />
      </div>
      <VideoReferencePicker
        value={referenceMode}
        onChange={handleReferenceModeChange}
        disabled={disabled}
      />
      <div className={disabled ? "pointer-events-none opacity-50" : undefined}>
        <VideoOutputSettings
          referenceMode={referenceMode}
          aspectRatio={aspectRatio}
          videoResolution={videoResolution}
          durationSec={durationSec}
          onAspectRatioChange={(v) => onAspectRatioChange(v as AspectRatio)}
          onVideoResolutionChange={onVideoResolutionChange}
          onDurationSecChange={onDurationSecChange}
          shotCount={smartMultiShotCount}
          disabled={disabled}
        />
      </div>
    </>
  );
}

/** 按即梦三种模式切换底部按钮组 */
export interface CreationDockToolbarProps {
  creationLane: CreationLane;
  onCreationLaneChange: (lane: CreationLane) => void;
  agentAvailable: boolean;
  disabled?: boolean;
  outputPrefMode: OutputPreferenceMode;
  onOutputPrefModeChange: (mode: OutputPreferenceMode) => void;
  dockSkillOptions: DockSkillOption[];
  dockSkillId: string | null;
  onDockSkillChange: (id: string | null) => void;
  skillTriggerLabel?: string;
  onInspirationClick?: () => void;
  inspirationActive?: boolean;
  models: ImageModel[];
  modelId: string;
  onModelChange: (id: string) => void;
  count: number;
  onCountChange: (n: number) => void;
  resolution: string;
  aspectRatio: AspectRatio;
  onResolutionChange: (v: string) => void;
  onAspectRatioChange: (v: AspectRatio) => void;
  videoReferenceMode: VideoReferenceMode;
  onVideoReferenceModeChange: (mode: VideoReferenceMode) => void;
  videoDurationSec: VideoDurationSec;
  onVideoDurationSecChange: (sec: VideoDurationSec) => void;
  videoResolution: VideoResolution;
  onVideoResolutionChange: (v: VideoResolution) => void;
  smartMultiShotCount?: number;
  videoAutoLabel?: string;
  videoRoutes?: VideoModelRouteMeta[];
}

export function CreationDockToolbar({
  creationLane,
  onCreationLaneChange,
  agentAvailable,
  disabled = false,
  outputPrefMode,
  onOutputPrefModeChange,
  dockSkillOptions,
  dockSkillId,
  onDockSkillChange,
  skillTriggerLabel = "使用技能",
  onInspirationClick,
  inspirationActive = false,
  models,
  modelId,
  onModelChange,
  count,
  onCountChange,
  resolution,
  aspectRatio,
  onResolutionChange,
  onAspectRatioChange,
  videoReferenceMode,
  onVideoReferenceModeChange,
  videoDurationSec,
  onVideoDurationSecChange,
  videoResolution,
  onVideoResolutionChange,
  smartMultiShotCount,
  videoAutoLabel,
  videoRoutes,
}: CreationDockToolbarProps) {
  return (
    <>
      <CreationLanePicker
        value={creationLane}
        onChange={onCreationLaneChange}
        agentAvailable={agentAvailable}
        disabled={disabled}
      />
      {/* Agent 模式：仅保留创作方式切换，与图片/视频车道一样简洁 */}
      {creationLane === "image" ? (
        <ImageDockSettings
          models={models}
          modelId={modelId}
          onModelChange={onModelChange}
          count={count}
          onCountChange={onCountChange}
          resolution={resolution}
          aspectRatio={aspectRatio}
          onResolutionChange={onResolutionChange}
          onAspectRatioChange={onAspectRatioChange}
          disabled={disabled}
        />
      ) : null}
      {creationLane === "video" ? (
        <VideoDockSettings
          models={models}
          modelId={modelId}
          onModelChange={onModelChange}
          aspectRatio={aspectRatio}
          onAspectRatioChange={onAspectRatioChange}
          referenceMode={videoReferenceMode}
          onReferenceModeChange={onVideoReferenceModeChange}
          durationSec={videoDurationSec}
          onDurationSecChange={onVideoDurationSecChange}
          videoResolution={videoResolution}
          onVideoResolutionChange={onVideoResolutionChange}
          smartMultiShotCount={smartMultiShotCount}
          videoAutoLabel={videoAutoLabel}
          videoRoutes={videoRoutes}
          disabled={disabled}
        />
      ) : null}
    </>
  );
}

export function buildDockSkillOptions(
  skills: AgentSkillPublic[],
  _includeEcommerce?: boolean,
): DockSkillOption[] {
  const dramaOption: DockSkillOption = {
    id: DRAMA_SKILL_ID,
    name: "AI 短剧",
    description: "多角色对白短剧，Anchor First 角色定稿 + 分镜 + 口型同步",
    badge: "new",
  };
  const ordered = [...skills].sort((a, b) => {
    if (a.id === ECOMMERCE_SET_SKILL_ID) return -1;
    if (b.id === ECOMMERCE_SET_SKILL_ID) return 1;
    if (a.id === "commerce-promo-v1") return -1;
    if (b.id === "commerce-promo-v1") return 1;
    if (a.id === "ecommerce-taobao-launch-v1") return -1;
    if (b.id === "ecommerce-taobao-launch-v1") return 1;
    return 0;
  });
  return [
    dramaOption,
    ...ordered.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      badge:
        s.id === ECOMMERCE_SET_SKILL_ID
          ? ("hot" as const)
          : s.id === "commerce-promo-v1"
            ? ("new" as const)
            : s.id === "ecommerce-taobao-launch-v1"
              ? ("new" as const)
              : undefined,
    })),
  ];
}
