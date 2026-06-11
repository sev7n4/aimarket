"use client";

import { useMemo, useRef, useState } from "react";
import {
  Clapperboard,
  Film,
  ImagePlus,
  Loader2,
  Mic,
  Plus,
  Trash2,
  Video,
} from "lucide-react";
import { CompactDockSheet } from "@/components/compact-dock-sheet";
import { assetUrl } from "@/lib/api-client";
import { VIDEO_CAMERA_TEMPLATES } from "@/lib/video-camera-templates";
import { assignOmniRefLabels } from "@/lib/video-mention";
import type {
  SmartMultiShot,
  VideoMediaRef,
  VideoMediaType,
  VideoReferenceMode,
} from "@/lib/creation-dock-prefs";

function normalizePreviewUrl(url: string): string {
  if (
    url.startsWith("http") ||
    url.startsWith("blob:") ||
    url.startsWith("data:")
  ) {
    return url;
  }
  return assetUrl(url);
}

function inferMediaType(mime: string): VideoMediaType {
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  return "image";
}

function mediaIcon(type: VideoMediaType) {
  if (type === "audio") return Mic;
  if (type === "video") return Video;
  return Film;
}

export interface VideoReferenceDockControlProps {
  mode: VideoReferenceMode;
  videoReferences: VideoMediaRef[];
  onVideoReferencesChange: (refs: VideoMediaRef[]) => void;
  smartMultiShots: SmartMultiShot[];
  onSmartMultiShotsChange: (shots: SmartMultiShot[]) => void;
  motionPrompt?: string;
  onMotionPromptChange?: (v: string) => void;
  onUpload: (file: File, role?: VideoMediaRef["role"]) => Promise<{
    assetId: string;
    url: string;
    mimeType: string;
  }>;
  disabled?: boolean;
  uploading?: boolean;
  /** 当前模型在智能多帧下会降级合并 prompt */
  smartMultiDegraded?: boolean;
}

/** Dock 单行：紧凑触发器 + 上方 Sheet 编辑参考素材（对标即梦） */
export function VideoReferenceDockControl({
  mode,
  videoReferences,
  onVideoReferencesChange,
  smartMultiShots,
  onSmartMultiShotsChange,
  motionPrompt = "",
  onMotionPromptChange,
  onUpload,
  disabled = false,
  uploading = false,
  smartMultiDegraded = false,
}: VideoReferenceDockControlProps) {
  const [open, setOpen] = useState(false);
  const [activeShotIndex, setActiveShotIndex] = useState(0);

  const labeledRefs = useMemo(
    () => assignOmniRefLabels(videoReferences),
    [videoReferences],
  );

  const previewItems = useMemo(() => {
    if (mode === "smart-multi-frame") {
      return smartMultiShots
        .filter((s) => s.previewUrl)
        .map((s, i) => ({
          id: s.assetId ?? `shot-${i}`,
          url: normalizePreviewUrl(s.previewUrl!),
        }));
    }
    if (mode === "first-last") {
      return labeledRefs
        .filter((r) => r.previewUrl)
        .map((r) => ({
          id: r.assetId,
          url: normalizePreviewUrl(r.previewUrl!),
        }));
    }
    return labeledRefs
      .filter((r) => r.previewUrl)
      .map((r) => ({
        id: r.assetId,
        url: normalizePreviewUrl(r.previewUrl!),
      }));
  }, [mode, labeledRefs, smartMultiShots]);

  const badgeLabel =
    mode === "smart-multi-frame"
      ? `${Math.max(smartMultiShots.length, 2)}镜`
      : mode === "first-last"
        ? "首尾帧"
        : previewItems.length
          ? `${previewItems.length}`
          : "参考";

  const sheetTitle =
    mode === "smart-multi-frame"
      ? "智能多帧"
      : mode === "first-last"
        ? "首尾帧"
        : "全能参考";

  return (
    <CompactDockSheet
      open={open}
      onClose={() => setOpen(false)}
      title={sheetTitle}
      dense
      fitContent={false}
      desktopWidthClass="w-[min(100vw-2rem,22rem)]"
      maxHeight="min(280px,46vh)"
      placement="above"
      trigger={
        <CompactRefTrigger
          items={previewItems}
          badge={badgeLabel}
          uploading={uploading}
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          ariaLabel={`${sheetTitle}，${previewItems.length} 条素材`}
        />
      }
    >
      {mode === "smart-multi-frame" ? (
        <SmartMultiFrameEditor
          shots={smartMultiShots}
          onChange={onSmartMultiShotsChange}
          onUpload={onUpload}
          disabled={disabled}
          activeIndex={activeShotIndex}
          onActiveIndexChange={setActiveShotIndex}
          degraded={smartMultiDegraded}
        />
      ) : mode === "first-last" ? (
        <FirstLastEditor
          refs={videoReferences}
          onChange={onVideoReferencesChange}
          motionPrompt={motionPrompt}
          onMotionPromptChange={onMotionPromptChange}
          onUpload={onUpload}
          disabled={disabled}
        />
      ) : (
        <OmniEditor
          refs={videoReferences}
          onChange={onVideoReferencesChange}
          onUpload={onUpload}
          disabled={disabled}
        />
      )}
    </CompactDockSheet>
  );
}

function CompactRefTrigger({
  items,
  badge,
  uploading,
  disabled,
  onClick,
  ariaLabel,
}: {
  items: Array<{ id: string; url: string }>;
  badge: string;
  uploading?: boolean;
  disabled?: boolean;
  onClick: () => void;
  ariaLabel: string;
}) {
  const spread = 4;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      title="参考素材"
      className="relative flex h-10 w-11 shrink-0 items-center justify-center overflow-visible disabled:opacity-50"
    >
      {items.slice(0, 3).map((item, i) => (
        <div
          key={item.id}
          className="absolute left-1/2 top-1/2 size-10 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-white/20 bg-zinc-900 shadow-lg"
          style={{
            transform: `translate(-50%, -50%) rotate(-12deg) translateX(${i * spread}px)`,
            zIndex: i + 10,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.url} alt="" className="size-full object-cover" />
        </div>
      ))}
      <span
        className={`absolute bottom-0 right-0 z-20 flex min-w-[1.1rem] items-center justify-center rounded-full px-0.5 text-[8px] font-medium ${
          items.length
            ? "bg-sky-600/90 text-white"
            : "bg-zinc-700/90 text-zinc-300"
        }`}
      >
        {uploading ? (
          <Loader2 className="size-2.5 animate-spin" />
        ) : (
          badge
        )}
      </span>
      {items.length === 0 ? (
        <Clapperboard className="relative z-[1] size-4 text-zinc-500" />
      ) : null}
    </button>
  );
}

const MINI_SLOT =
  "flex size-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-white/15 bg-white/[0.03] text-[8px] text-zinc-500 transition hover:border-sky-500/40 hover:bg-white/[0.06]";

function OmniEditor({
  refs,
  onChange,
  onUpload,
  disabled,
}: {
  refs: VideoMediaRef[];
  onChange: (refs: VideoMediaRef[]) => void;
  onUpload: VideoReferenceDockControlProps["onUpload"];
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const labeled = assignOmniRefLabels(refs);

  async function onFile(file: File) {
    if (refs.length >= 12) return;
    const uploaded = await onUpload(file);
    const mediaType = inferMediaType(uploaded.mimeType);
    const next = [
      ...refs,
      {
        assetId: uploaded.assetId,
        mediaType,
        role: "reference" as const,
        previewUrl: normalizePreviewUrl(uploaded.url),
      },
    ];
    onChange(assignOmniRefLabels(next));
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] leading-snug text-zinc-500">
        图/音/视参考（最多 12 条）。描述中用 @{labeled[0]?.label ?? "图片1"}{" "}
        引用并说明作用。
      </p>
      <div className="flex flex-wrap gap-1.5">
        {labeled.map((ref, i) => {
          const Icon = mediaIcon(ref.mediaType);
          return (
            <div key={ref.assetId} className="relative">
              {ref.previewUrl && ref.mediaType === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={normalizePreviewUrl(ref.previewUrl)}
                  alt=""
                  className="size-12 rounded-lg object-cover ring-1 ring-white/10"
                />
              ) : (
                <div className="flex size-12 flex-col items-center justify-center rounded-lg bg-white/5 text-[8px] text-zinc-400 ring-1 ring-white/10">
                  <Icon className="mb-0.5 size-3.5" />
                  {ref.mediaType}
                </div>
              )}
              <span className="absolute bottom-0 left-0 rounded-br-lg rounded-tl-lg bg-black/70 px-0.5 text-[7px] text-zinc-200">
                {ref.label ?? `#${i + 1}`}
              </span>
              {!disabled ? (
                <button
                  type="button"
                  onClick={() =>
                    onChange(assignOmniRefLabels(refs.filter((r) => r.assetId !== ref.assetId)))
                  }
                  className="absolute -right-1 -top-1 rounded-full bg-zinc-800 p-0.5"
                >
                  <Trash2 className="size-2.5 text-zinc-400" />
                </button>
              ) : null}
            </div>
          );
        })}
        {refs.length < 12 && !disabled ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={MINI_SLOT}
          >
            <Plus className="size-3.5 opacity-60" />
            添加
          </button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,audio/*,video/mp4,video/webm"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function FirstLastEditor({
  refs,
  onChange,
  motionPrompt,
  onMotionPromptChange,
  onUpload,
  disabled,
}: {
  refs: VideoMediaRef[];
  onChange: (refs: VideoMediaRef[]) => void;
  motionPrompt?: string;
  onMotionPromptChange?: (v: string) => void;
  onUpload: VideoReferenceDockControlProps["onUpload"];
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingRole = useRef<"first_frame" | "last_frame">("first_frame");
  const first = refs.find((r) => r.role === "first_frame");
  const last = refs.find((r) => r.role === "last_frame");

  async function pick(role: "first_frame" | "last_frame", file: File) {
    const uploaded = await onUpload(file, role);
    const next = refs.filter((r) => r.role !== role);
    next.push({
      assetId: uploaded.assetId,
      mediaType: inferMediaType(uploaded.mimeType),
      role,
      previewUrl: normalizePreviewUrl(uploaded.url),
    });
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <FrameSlot
          label="首帧"
          refItem={first}
          disabled={disabled}
          onPick={() => {
            pendingRole.current = "first_frame";
            inputRef.current?.click();
          }}
          onClear={() => onChange(refs.filter((r) => r.role !== "first_frame"))}
        />
        <FrameSlot
          label="尾帧"
          refItem={last}
          disabled={disabled}
          onPick={() => {
            pendingRole.current = "last_frame";
            inputRef.current?.click();
          }}
          onClear={() => onChange(refs.filter((r) => r.role !== "last_frame"))}
        />
      </div>
      {onMotionPromptChange ? (
        <>
          <input
            value={motionPrompt}
            onChange={(e) => onMotionPromptChange(e.target.value)}
            disabled={disabled}
            placeholder="首尾帧之间的运动与过渡…"
            className="w-full rounded-md border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-sky-500/40 focus:outline-none"
          />
          <div className="flex flex-wrap gap-1">
            {VIDEO_CAMERA_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                disabled={disabled}
                onClick={() => onMotionPromptChange(tpl.prompt)}
                className="rounded-md bg-white/5 px-1.5 py-0.5 text-[9px] text-zinc-400 transition hover:bg-sky-500/20 hover:text-sky-200"
              >
                {tpl.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void pick(pendingRole.current, file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function FrameSlot({
  label,
  refItem,
  onPick,
  onClear,
  disabled,
}: {
  label: string;
  refItem?: VideoMediaRef;
  onPick: () => void;
  onClear: () => void;
  disabled?: boolean;
}) {
  if (refItem?.previewUrl) {
    return (
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={normalizePreviewUrl(refItem.previewUrl)}
          alt={label}
          className="size-12 rounded-lg object-cover ring-1 ring-white/10"
        />
        <span className="absolute bottom-0 left-0 rounded-br-lg rounded-tl-lg bg-black/60 px-0.5 text-[8px] text-zinc-300">
          {label}
        </span>
        {!disabled ? (
          <button
            type="button"
            onClick={onClear}
            className="absolute -right-1 -top-1 rounded-full bg-zinc-800 p-0.5 text-zinc-400 hover:text-white"
          >
            <Trash2 className="size-2.5" />
          </button>
        ) : null}
      </div>
    );
  }
  return (
    <button type="button" disabled={disabled} onClick={onPick} className={MINI_SLOT}>
      <ImagePlus className="size-3.5 opacity-60" />
      {label}
    </button>
  );
}

function SmartMultiFrameEditor({
  shots,
  onChange,
  onUpload,
  disabled,
  activeIndex,
  onActiveIndexChange,
  degraded,
}: {
  shots: SmartMultiShot[];
  onChange: (shots: SmartMultiShot[]) => void;
  onUpload: VideoReferenceDockControlProps["onUpload"];
  disabled?: boolean;
  activeIndex: number;
  onActiveIndexChange: (i: number) => void;
  degraded?: boolean;
}) {
  const list =
    shots.length >= 2
      ? shots
      : [
          { order: 0, motionPrompt: "" },
          { order: 1, motionPrompt: "" },
        ];

  function updateShot(index: number, patch: Partial<SmartMultiShot>) {
    const next = list.map((s, i) =>
      i === index ? { ...s, ...patch, order: i } : s,
    );
    onChange(next);
  }

  function addShot() {
    if (list.length >= 12) return;
    onChange([...list, { order: list.length, motionPrompt: "" }]);
    onActiveIndexChange(list.length);
  }

  function removeShot(index: number) {
    if (list.length <= 2) return;
    onChange(
      list
        .filter((_, i) => i !== index)
        .map((s, i) => ({ ...s, order: i })),
    );
    onActiveIndexChange(Math.max(0, index - 1));
  }

  const active = list[activeIndex] ?? list[0]!;

  return (
    <div className="space-y-2">
      {degraded ? (
        <p className="rounded-md bg-amber-500/10 px-2 py-1 text-[9px] text-amber-200/90">
          当前模型将合并 prompt 与首图，非原生多帧 API
        </p>
      ) : null}
      <p className="text-[10px] text-zinc-500">16:9 · 720P · 每镜参考图 + 运镜</p>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {list.map((shot, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onActiveIndexChange(i)}
            className={`relative shrink-0 rounded-lg ring-1 transition ${
              i === activeIndex
                ? "ring-sky-500/60"
                : "ring-white/10 hover:ring-white/20"
            }`}
          >
            <ShotThumb
              shot={shot}
              index={i}
              disabled={disabled}
              compact
              onUpload={async (file) => {
                const uploaded = await onUpload(file);
                updateShot(i, {
                  assetId: uploaded.assetId,
                  previewUrl: normalizePreviewUrl(uploaded.url),
                });
              }}
              onClear={() =>
                updateShot(i, { assetId: undefined, previewUrl: undefined })
              }
            />
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded bg-black/70 px-1 text-[7px] text-zinc-300">
              {i + 1}
            </span>
          </button>
        ))}
        {list.length < 12 && !disabled ? (
          <button
            type="button"
            onClick={addShot}
            className={`${MINI_SLOT} shrink-0`}
          >
            <Plus className="size-3.5" />
          </button>
        ) : null}
      </div>
      <div className="flex items-center gap-1">
        <input
          value={active.motionPrompt}
          onChange={(e) => updateShot(activeIndex, { motionPrompt: e.target.value })}
          disabled={disabled}
          placeholder={`镜头 ${activeIndex + 1} 运镜/动作`}
          className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-sky-500/40 focus:outline-none"
        />
        {list.length > 2 && !disabled ? (
          <button
            type="button"
            onClick={() => removeShot(activeIndex)}
            className="shrink-0 rounded p-1 text-zinc-500 hover:text-red-400"
            aria-label="删除镜头"
          >
            <Trash2 className="size-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ShotThumb({
  shot,
  index: _index,
  onUpload,
  onClear,
  disabled,
  compact = false,
}: {
  shot: SmartMultiShot;
  index: number;
  onUpload: (file: File) => void;
  onClear: () => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const sizeClass = compact ? "size-12" : "size-14";

  if (shot.previewUrl) {
    return (
      <div className={`relative shrink-0 ${sizeClass}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={normalizePreviewUrl(shot.previewUrl)}
          alt=""
          className={`${sizeClass} rounded-md object-cover ring-1 ring-white/10`}
        />
        {!disabled ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="absolute -right-1 -top-1 rounded-full bg-zinc-800 p-0.5"
          >
            <Trash2 className="size-2.5 text-zinc-400" />
          </button>
        ) : null}
      </div>
    );
  }
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          inputRef.current?.click();
        }}
        className={`${MINI_SLOT} ${sizeClass}`}
      >
        <ImagePlus className="size-3.5" />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
          e.target.value = "";
        }}
      />
    </>
  );
}

/** @deprecated 使用 VideoReferenceDockControl */
export const VideoReferenceSlots = VideoReferenceDockControl;
export type VideoReferenceSlotsProps = VideoReferenceDockControlProps;
