"use client";

import { useRef } from "react";
import { Film, ImagePlus, Mic, Plus, Trash2, Video } from "lucide-react";
import type {
  SmartMultiShot,
  VideoMediaRef,
  VideoMediaType,
  VideoReferenceMode,
} from "@/lib/creation-dock-prefs";

const SLOT =
  "flex h-16 w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-white/15 bg-white/[0.03] text-[9px] text-zinc-500 transition hover:border-sky-500/40 hover:bg-white/[0.06]";

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

export interface VideoReferenceSlotsProps {
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
}

export function VideoReferenceSlots({
  mode,
  videoReferences,
  onVideoReferencesChange,
  smartMultiShots,
  onSmartMultiShotsChange,
  motionPrompt = "",
  onMotionPromptChange,
  onUpload,
  disabled = false,
}: VideoReferenceSlotsProps) {
  if (mode === "first-last") {
    return (
      <FirstLastSlots
        refs={videoReferences}
        onChange={onVideoReferencesChange}
        motionPrompt={motionPrompt}
        onMotionPromptChange={onMotionPromptChange}
        onUpload={onUpload}
        disabled={disabled}
      />
    );
  }
  if (mode === "smart-multi-frame") {
    return (
      <SmartMultiFrameSlots
        shots={smartMultiShots}
        onChange={onSmartMultiShotsChange}
        onUpload={onUpload}
        disabled={disabled}
      />
    );
  }
  return (
    <OmniSlots
      refs={videoReferences}
      onChange={onVideoReferencesChange}
      onUpload={onUpload}
      disabled={disabled}
    />
  );
}

function FirstLastSlots({
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
  onUpload: VideoReferenceSlotsProps["onUpload"];
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
      previewUrl: uploaded.url,
    });
    onChange(next);
  }

  return (
    <div className="mb-2 space-y-2">
      <div className="flex flex-wrap items-start gap-2">
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
      {onMotionPromptChange ? (
        <textarea
          value={motionPrompt}
          onChange={(e) => onMotionPromptChange(e.target.value)}
          disabled={disabled}
          placeholder="描述首尾帧之间的运动与过渡…"
          rows={2}
          className="w-full resize-none rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-sky-500/40 focus:outline-none"
        />
      ) : null}
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
          src={refItem.previewUrl}
          alt={label}
          className="h-16 w-16 rounded-lg object-cover ring-1 ring-white/10"
        />
        <span className="absolute bottom-0 left-0 rounded-br-lg rounded-tl-lg bg-black/60 px-1 text-[9px] text-zinc-300">
          {label}
        </span>
        {!disabled ? (
          <button
            type="button"
            onClick={onClear}
            className="absolute -right-1 -top-1 rounded-full bg-zinc-800 p-0.5 text-zinc-400 hover:text-white"
          >
            <Trash2 className="size-3" />
          </button>
        ) : null}
      </div>
    );
  }
  return (
    <button type="button" disabled={disabled} onClick={onPick} className={SLOT}>
      <ImagePlus className="size-4 opacity-60" />
      {label}
    </button>
  );
}

function OmniSlots({
  refs,
  onChange,
  onUpload,
  disabled,
}: {
  refs: VideoMediaRef[];
  onChange: (refs: VideoMediaRef[]) => void;
  onUpload: VideoReferenceSlotsProps["onUpload"];
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File) {
    if (refs.length >= 12) return;
    const uploaded = await onUpload(file);
    onChange([
      ...refs,
      {
        assetId: uploaded.assetId,
        mediaType: inferMediaType(uploaded.mimeType),
        role: "reference",
        previewUrl: uploaded.url,
        label: `素材${refs.length + 1}`,
      },
    ]);
  }

  return (
    <div className="mb-2">
      <p className="mb-1.5 text-[10px] text-zinc-500">
        上传图/音/视参考（最多 12 条）；prompt 可用 @图片1 模仿 @视频1…
      </p>
      <div className="flex flex-wrap gap-2">
        {refs.map((ref, i) => {
          const Icon = mediaIcon(ref.mediaType);
          return (
            <div key={ref.assetId} className="relative">
              {ref.previewUrl && ref.mediaType === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={ref.previewUrl}
                  alt=""
                  className="h-14 w-14 rounded-lg object-cover ring-1 ring-white/10"
                />
              ) : (
                <div className="flex h-14 w-14 flex-col items-center justify-center rounded-lg bg-white/5 text-[9px] text-zinc-400 ring-1 ring-white/10">
                  <Icon className="mb-0.5 size-4" />
                  {ref.mediaType}
                </div>
              )}
              <span className="absolute bottom-0 left-0 rounded-br-lg rounded-tl-lg bg-black/60 px-1 text-[8px]">
                {ref.label ?? `#${i + 1}`}
              </span>
              {!disabled ? (
                <button
                  type="button"
                  onClick={() => onChange(refs.filter((r) => r.assetId !== ref.assetId))}
                  className="absolute -right-1 -top-1 rounded-full bg-zinc-800 p-0.5"
                >
                  <Trash2 className="size-3 text-zinc-400" />
                </button>
              ) : null}
            </div>
          );
        })}
        {refs.length < 12 ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className={SLOT}
          >
            <Plus className="size-4 opacity-60" />
            添加
          </button>
        ) : null}
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
    </div>
  );
}

function SmartMultiFrameSlots({
  shots,
  onChange,
  onUpload,
  disabled,
}: {
  shots: SmartMultiShot[];
  onChange: (shots: SmartMultiShot[]) => void;
  onUpload: VideoReferenceSlotsProps["onUpload"];
  disabled?: boolean;
}) {
  const list =
    shots.length >= 2
      ? shots
      : [
          { order: 0, motionPrompt: "" },
          { order: 1, motionPrompt: "" },
        ];

  function updateShot(index: number, patch: Partial<SmartMultiShot>) {
    const next = list.map((s, i) => (i === index ? { ...s, ...patch, order: i } : s));
    onChange(next);
  }

  function addShot() {
    if (list.length >= 12) return;
    onChange([...list, { order: list.length, motionPrompt: "" }]);
  }

  function removeShot(index: number) {
    if (list.length <= 2) return;
    onChange(
      list
        .filter((_, i) => i !== index)
        .map((s, i) => ({ ...s, order: i })),
    );
  }

  return (
    <div className="mb-2 space-y-2">
      <p className="text-[10px] text-zinc-500">
        智能多帧 · 16:9 720P · 每镜头参考图 + 运镜描述（至少 2 镜）
      </p>
      {list.map((shot, i) => (
        <div
          key={i}
          className="flex items-start gap-2 rounded-lg border border-white/8 bg-white/[0.02] p-2"
        >
          <ShotThumb
            shot={shot}
            disabled={disabled}
            onUpload={async (file) => {
              const uploaded = await onUpload(file);
              updateShot(i, {
                assetId: uploaded.assetId,
                previewUrl: uploaded.url,
              });
            }}
            onClear={() =>
              updateShot(i, { assetId: undefined, previewUrl: undefined })
            }
          />
          <textarea
            value={shot.motionPrompt}
            onChange={(e) => updateShot(i, { motionPrompt: e.target.value })}
            disabled={disabled}
            placeholder={`镜头 ${i + 1} 运镜/动作描述`}
            rows={2}
            className="min-h-[3.5rem] flex-1 resize-none rounded-md border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-sky-500/30"
          />
          {list.length > 2 && !disabled ? (
            <button
              type="button"
              onClick={() => removeShot(i)}
              className="mt-1 rounded p-1 text-zinc-500 hover:text-red-400"
            >
              <Trash2 className="size-3.5" />
            </button>
          ) : null}
        </div>
      ))}
      {list.length < 12 && !disabled ? (
        <button
          type="button"
          onClick={addShot}
          className="inline-flex items-center gap-1 text-[10px] text-sky-400/90 hover:text-sky-300"
        >
          <Plus className="size-3" />
          添加镜头
        </button>
      ) : null}
    </div>
  );
}

function ShotThumb({
  shot,
  onUpload,
  onClear,
  disabled,
}: {
  shot: SmartMultiShot;
  onUpload: (file: File) => void;
  onClear: () => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  if (shot.previewUrl) {
    return (
      <div className="relative shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={shot.previewUrl}
          alt=""
          className="h-14 w-14 rounded-md object-cover ring-1 ring-white/10"
        />
        {!disabled ? (
          <button
            type="button"
            onClick={onClear}
            className="absolute -right-1 -top-1 rounded-full bg-zinc-800 p-0.5"
          >
            <Trash2 className="size-3 text-zinc-400" />
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
        onClick={() => inputRef.current?.click()}
        className={`${SLOT} h-14 w-14`}
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
