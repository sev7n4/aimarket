"use client";

import { useRef, useState } from "react";
import { Crosshair, ImagePlus, Pencil, RotateCcw, Settings2, X } from "lucide-react";
import type { FocusEditIntent, FocusPointChip } from "@/lib/focus-edit";
import {
  MAX_FOCUS_POINTS,
  CROP_SIZE_OPTIONS,
  DEFAULT_CROP_SIZE,
} from "@/lib/focus-edit";
import { focusIndexLabel } from "@/lib/focus-index-labels";
import { assetUrl } from "@/lib/api-client";

interface FocusEditChipsProps {
  points: FocusPointChip[];
  intent: FocusEditIntent;
  cropSize?: number;
  recognizing?: boolean;
  sessionId?: string;
  onIntentChange: (intent: FocusEditIntent) => void;
  onCropSizeChange?: (size: number) => void;
  onRemove: (pointId: string) => void;
  onEdit?: (pointId: string, newName: string) => void;
  onChipPromptChange?: (pointId: string, prompt: string) => void;
  onReplaceImage?: (pointId: string, assetId: string, url: string) => void;
  onClearAll?: () => void;
  onCancel?: () => void;
}

export function FocusEditChips({
  points,
  intent,
  cropSize = DEFAULT_CROP_SIZE,
  recognizing = false,
  sessionId,
  onIntentChange,
  onCropSizeChange,
  onRemove,
  onEdit,
  onChipPromptChange,
  onReplaceImage,
  onClearAll,
  onCancel,
}: FocusEditChipsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<string | null>(null);

  function startEdit(pointId: string, currentName: string) {
    setEditingId(pointId);
    setEditValue(currentName);
  }

  function commitEdit() {
    if (editingId && onEdit && editValue.trim()) {
      onEdit(editingId, editValue.trim());
    }
    setEditingId(null);
    setEditValue("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValue("");
  }

  const currentCropOption = CROP_SIZE_OPTIONS.find(
    (o) => o.value === cropSize,
  ) ?? CROP_SIZE_OPTIONS[1];

  return (
    <div
      data-testid="focus-edit-panel"
      className="mt-2 rounded-xl border border-purple-500/25 bg-purple-500/5 p-2.5"
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 text-[11px] font-medium text-purple-200">
          <Crosshair className="size-3.5" strokeWidth={1.6} />
          焦点编辑
        </span>
        <span className="text-[10px] text-zinc-500">
          {points.length}/{MAX_FOCUS_POINTS}
        </span>
        {recognizing ? (
          <span className="text-[10px] text-zinc-500">识别中…</span>
        ) : null}
        <div className="ml-auto flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => onIntentChange("edit")}
            className={`rounded-full px-2 py-0.5 text-[10px] transition ${
              intent === "edit"
                ? "bg-purple-500 text-white"
                : "bg-white/10 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            局部修改
          </button>
          <button
            type="button"
            onClick={() => onIntentChange("replace")}
            className={`rounded-full px-2 py-0.5 text-[10px] transition ${
              intent === "replace"
                ? "bg-purple-500 text-white"
                : "bg-white/10 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            对象替换
          </button>
          {points.length > 0 && onClearAll ? (
            <button
              type="button"
              onClick={onClearAll}
              className="inline-flex items-center gap-0.5 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-zinc-400 hover:text-zinc-200"
              title="清除全部焦点"
            >
              <RotateCcw className="size-3" />
              清除
            </button>
          ) : null}
          {onCropSizeChange ? (
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className={`rounded-full px-2 py-0.5 text-[10px] transition ${
                showSettings
                  ? "bg-white/20 text-zinc-200"
                  : "bg-white/10 text-zinc-400 hover:text-zinc-200"
              }`}
              title="调整焦点大小"
            >
              <Settings2 className="size-3" />
            </button>
          ) : null}
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-zinc-400 hover:text-zinc-200"
            >
              退出
            </button>
          ) : null}
        </div>
      </div>

      {showSettings && onCropSizeChange ? (
        <div className="mb-2 rounded-lg border border-white/10 bg-black/30 p-2">
          <p className="mb-1.5 text-[10px] text-zinc-400">焦点识别范围</p>
          <div className="flex flex-wrap gap-1">
            {CROP_SIZE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onCropSizeChange(opt.value)}
                className={`rounded-full px-2 py-1 text-[10px] transition ${
                  cropSize === opt.value
                    ? "bg-purple-500/30 text-purple-100 ring-1 ring-purple-400/50"
                    : "bg-white/5 text-zinc-500 hover:bg-white/10 hover:text-zinc-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[9px] text-zinc-600">
            当前：{currentCropOption.hint}
          </p>
        </div>
      ) : null}

      <input
        ref={uploadRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          const pointId = uploadTargetRef.current;
          if (!file || !pointId || !onReplaceImage) return;
          void (async () => {
            if (!sessionId) return;
            const { uploadAsset } = await import("@/lib/api-client");
            const { id, url } = await uploadAsset(file, sessionId);
            onReplaceImage(pointId, id, url);
          })();
        }}
      />

      {points.length > 0 ? (
        <div className="space-y-2">
          {points.map((p, i) => (
            <div
              key={p.pointId}
              data-testid={`focus-edit-chip-${i}`}
              className="rounded-lg border border-purple-400/25 bg-purple-500/10 p-2"
            >
              <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-semibold text-purple-200">
                  {focusIndexLabel(i)}
                </span>
                {editingId === p.pointId ? (
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitEdit();
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        cancelEdit();
                      }
                    }}
                    onBlur={commitEdit}
                    autoFocus
                    maxLength={24}
                    className="min-w-0 flex-1 rounded bg-black/40 px-1.5 py-0.5 text-[11px] text-purple-100 outline-none ring-1 ring-purple-400/50"
                  />
                ) : (
                  <>
                    <span className="text-[11px] text-purple-100">
                      {p.objectName}
                    </span>
                    {onEdit ? (
                      <button
                        type="button"
                        aria-label={`编辑焦点名称 ${p.objectName}`}
                        onClick={() => startEdit(p.pointId, p.objectName)}
                        className="rounded-full p-0.5 text-purple-200/60 hover:bg-white/10 hover:text-purple-100"
                      >
                        <Pencil className="size-3" />
                      </button>
                    ) : null}
                  </>
                )}
                {intent === "replace" && onReplaceImage ? (
                  <button
                    type="button"
                    onClick={() => {
                      uploadTargetRef.current = p.pointId;
                      uploadRef.current?.click();
                    }}
                    className="inline-flex items-center gap-0.5 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-zinc-300 hover:text-white"
                    title="上传替换参考图"
                  >
                    <ImagePlus className="size-3" />
                    {p.replaceAssetUrl ? "换图" : "上传"}
                  </button>
                ) : null}
                <button
                  type="button"
                  aria-label={`移除焦点 ${p.objectName}`}
                  onClick={() => onRemove(p.pointId)}
                  className="ml-auto rounded-full p-0.5 text-purple-200/80 hover:bg-white/10 hover:text-white"
                >
                  <X className="size-3" />
                </button>
              </div>
              {p.replaceAssetUrl ? (
                <div className="mb-1.5 flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={assetUrl(p.replaceAssetUrl)}
                    alt=""
                    className="size-8 rounded border border-white/10 object-cover"
                  />
                  <span className="text-[10px] text-zinc-500">替换参考图</span>
                </div>
              ) : null}
              {onChipPromptChange ? (
                <input
                  type="text"
                  value={p.chipPrompt ?? ""}
                  onChange={(e) =>
                    onChipPromptChange(p.pointId, e.target.value)
                  }
                  placeholder={
                    intent === "replace"
                      ? "描述要替换成什么，或已上传参考图"
                      : "短 prompt：如改成红色、改成「SALE」"
                  }
                  className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:border-purple-400/40 focus:outline-none"
                />
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-zinc-500">
          在画布图片上点击要编辑的位置（最多 {MAX_FOCUS_POINTS} 个焦点）
        </p>
      )}
    </div>
  );
}
