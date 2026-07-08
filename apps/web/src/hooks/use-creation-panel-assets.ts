"use client";

import type { CreationMode } from "@aimarket/ui";
import { useEffect, useMemo, useRef, useState } from "react";

import type { MentionItem } from "@/components/mention-picker";
import type { ReferenceChipItem } from "@/components/reference-chips";
import type { UploadPreviewItem } from "@/components/upload-preview-stack";
import {
  canAutoBindCanvasItem,
  mergeReferenceSources,
} from "@/lib/canvas-reference-bind";
import type { CanvasItem } from "@/lib/canvas-tools";
import type { CreationLane, VideoMediaRef, VideoReferenceMode } from "@/lib/creation-dock-prefs";
import { assetUrl } from "@/lib/api/core";
import { uploadAsset } from "@/lib/api/assets";
import { reversePromptFromImage } from "@/lib/api/generation";
import { ensureSession } from "@/lib/api/sessions";
import { trackEvent } from "@/lib/api/studio";
import {
  extractMentionLabelsFromPrompt,
  filterAssetIdsByPromptLabels,
  filterRefsByPromptLabels,
  removeMentionTokenFromPrompt,
} from "@/lib/mention-sync";
import type { PendingAsset } from "@/lib/pending-assets";
import type { SessionReference } from "@/lib/types";
import { videoRefsToMentionCandidates } from "@/lib/video-mention";

export type UseCreationPanelAssetsInput = {
  sessionId?: string;
  mode: CreationMode;
  user: { id: string } | null;
  homeDirectSubmit: boolean;
  restoredAssets?: PendingAsset[];
  onAuthRequired?: (hint?: string) => void;
  onUploadToCanvas?: (
    assetId: string,
    url: string,
    thumbUrl?: string,
  ) => void;
  sessionEnsuredRef: React.MutableRefObject<boolean>;
  prompt: string;
  setPrompt: (p: string | ((prev: string) => string)) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  canvasItems: CanvasItem[];
  selectedCanvasItem: CanvasItem | null | undefined;
  onClearCanvasSelection?: () => void;
  creationLane: CreationLane;
  focusEditActive: boolean;
  videoReferences: VideoMediaRef[];
  videoReferenceMode: VideoReferenceMode;
};

export function useCreationPanelAssets(input: UseCreationPanelAssetsInput) {
  const {
    sessionId,
    mode,
    user,
    homeDirectSubmit,
    restoredAssets,
    onAuthRequired,
    onUploadToCanvas,
    sessionEnsuredRef,
    prompt,
    setPrompt,
    textareaRef,
    canvasItems,
    selectedCanvasItem,
    onClearCanvasSelection,
    creationLane,
    focusEditActive,
    videoReferences,
    videoReferenceMode,
  } = input;

  const fileRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<"product" | "reference" | "general">("general");
  const handleUploadRef = useRef<(files: File[]) => Promise<void>>(async () => {});

  const [uploadTarget, setUploadTarget] = useState<
    "product" | "reference" | "general"
  >("general");
  const [assetIds, setAssetIds] = useState<string[]>([]);
  const [productAssetId, setProductAssetId] = useState<string | null>(null);
  const [referenceAssetId, setReferenceAssetId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedRefs, setSelectedRefs] = useState<SessionReference[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionedAssetIds, setMentionedAssetIds] = useState<string[]>([]);
  const [mentionedAssetPreviews, setMentionedAssetPreviews] = useState<
    Array<UploadPreviewItem & { label?: string }>
  >([]);
  const [uploadPreviews, setUploadPreviews] = useState<UploadPreviewItem[]>([]);
  const [uploadPreviewIndex, setUploadPreviewIndex] = useState<number | null>(
    null,
  );
  const [reversing, setReversing] = useState(false);

  function requireAuth(hint: string): boolean {
    if (user) return true;
    onAuthRequired?.(hint);
    return false;
  }

  function buildReferenceSources() {
    return mergeReferenceSources(
      {
        assetIds,
        mentionedAssetIds,
        selectedRefIds: selectedRefs.map((r) => r.id),
      },
      selectedCanvasItem,
      creationLane,
      focusEditActive,
    );
  }

  function resolveProductAssetId() {
    return productAssetId ?? assetIds[0] ?? mentionedAssetIds[0] ?? undefined;
  }

  function resolveAssetMentionLabel(assetId: string): string | undefined {
    const preview = mentionedAssetPreviews.find((p) => p.id === assetId);
    if (preview?.label) return preview.label;
    const canvasIdx = canvasItems.findIndex((item) => item.assetId === assetId);
    if (canvasIdx >= 0) {
      return canvasItems[canvasIdx]?.label ?? `图${canvasIdx + 1}`;
    }
    const uploadIdx = uploadPreviews.findIndex((p) => p.id === assetId);
    if (uploadIdx >= 0) {
      return `上传图${uploadIdx + 1}`;
    }
    const videoRef = videoReferences.find((r) => r.assetId === assetId);
    if (videoRef?.label) return videoRef.label;
    return undefined;
  }

  function syncMentionStateFromPrompt(nextPrompt: string) {
    const labels = extractMentionLabelsFromPrompt(nextPrompt);
    setSelectedRefs((prev) => filterRefsByPromptLabels(prev, labels));
    const labelByAssetId = new Map<string, string>();
    for (const assetId of mentionedAssetIds) {
      const label = resolveAssetMentionLabel(assetId);
      if (label) labelByAssetId.set(assetId, label);
    }
    setMentionedAssetIds((prev) =>
      filterAssetIdsByPromptLabels(prev, labelByAssetId, labels),
    );
    setMentionedAssetPreviews((prev) =>
      prev.filter((preview) => {
        const label = preview.label ?? resolveAssetMentionLabel(preview.id);
        return label != null && labels.includes(label);
      }),
    );
  }

  const canvasReferenceActive =
    canAutoBindCanvasItem(
      selectedCanvasItem,
      creationLane,
      focusEditActive,
    ) && creationLane !== "video";

  const referenceChips = useMemo((): ReferenceChipItem[] => {
    const chips: ReferenceChipItem[] = [];
    if (canvasReferenceActive && selectedCanvasItem) {
      chips.push({
        id: selectedCanvasItem.id,
        variant: "canvas",
        label: selectedCanvasItem.label ?? "图片",
        url: selectedCanvasItem.url,
      });
    }
    for (const ref of selectedRefs) {
      chips.push({
        id: ref.id,
        variant: "mention-output",
        label: ref.label,
        url: ref.url,
      });
    }
    for (const assetId of mentionedAssetIds) {
      const preview = mentionedAssetPreviews.find((p) => p.id === assetId);
      chips.push({
        id: assetId,
        variant: "mention-asset",
        label: preview?.label ?? resolveAssetMentionLabel(assetId) ?? "素材",
        url: preview?.url,
      });
    }
    return chips;
  }, [
    canvasReferenceActive,
    selectedCanvasItem,
    selectedRefs,
    mentionedAssetIds,
    mentionedAssetPreviews,
    canvasItems,
    uploadPreviews,
    videoReferences,
  ]);

  function handleRemoveReferenceChip(chip: ReferenceChipItem) {
    if (chip.variant === "canvas") {
      onClearCanvasSelection?.();
      return;
    }
    if (chip.variant === "mention-output") {
      setSelectedRefs((prev) => prev.filter((ref) => ref.id !== chip.id));
      setPrompt(removeMentionTokenFromPrompt(prompt, chip.label));
      return;
    }
    setMentionedAssetIds((prev) => prev.filter((id) => id !== chip.id));
    setMentionedAssetPreviews((prev) => prev.filter((p) => p.id !== chip.id));
    setPrompt(removeMentionTokenFromPrompt(prompt, chip.label));
  }

  function insertMention(item: MentionItem, promptSuffix = "") {
    const textarea = textareaRef.current;
    const labelTok = `@${item.label} `;
    const insertText = promptSuffix ? `${labelTok}${promptSuffix}` : labelTok;
    if (textarea) {
      const value = textarea.value;
      const caret = textarea.selectionStart ?? value.length;
      const before = value.slice(0, caret);
      const after = value.slice(caret);
      const atIdx = before.lastIndexOf("@");
      const replaceFrom = atIdx >= 0 ? atIdx : caret;
      const next = `${value.slice(0, replaceFrom)}${insertText}${after}`;
      setPrompt(next);
      requestAnimationFrame(() => {
        if (!textareaRef.current) return;
        const pos = replaceFrom + insertText.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(pos, pos);
      });
    } else {
      setPrompt((p) => `${p}${insertText}`);
    }

    if (item.source === "history-output" || item.source === "canvas-output") {
      const refLike: SessionReference = {
        id: item.outputId,
        url: item.url,
        label: item.label,
        createdAt: new Date().toISOString(),
      };
      setSelectedRefs((prev) =>
        prev.find((r) => r.id === refLike.id) ? prev : [...prev, refLike],
      );
    } else if (item.source === "canvas-asset" || item.source === "upload-asset") {
      setMentionedAssetIds((prev) =>
        prev.includes(item.assetId) ? prev : [...prev, item.assetId],
      );
      setMentionedAssetPreviews((prev) =>
        prev.find((p) => p.id === item.assetId)
          ? prev
          : [...prev, { id: item.assetId, url: item.url, label: item.label }],
      );
    }

    setMentionOpen(false);
    setMentionQuery("");
  }

  async function handleUpload(selectedFiles: File[]) {
    if (!selectedFiles.length || !sessionId) return;
    if (!requireAuth("登录后即可上传参考图")) return;
    const target = uploadTargetRef.current;
    setUploading(true);
    try {
      if (user) {
        await ensureSession(sessionId, mode);
        sessionEnsuredRef.current = true;
      }
      if (target === "product") {
        const asset = await uploadAsset(selectedFiles[0]!, sessionId);
        setProductAssetId(asset.id);
        return;
      }
      if (target === "reference") {
        const asset = await uploadAsset(selectedFiles[0]!, sessionId);
        setReferenceAssetId(asset.id);
        return;
      }
      const remaining = Math.max(0, 4 - assetIds.length);
      const batch = selectedFiles.slice(0, remaining);
      for (const file of batch) {
        const asset = await uploadAsset(file, sessionId);
        const previewUrl =
          asset.url.startsWith("http") || asset.url.startsWith("blob:")
            ? asset.url
            : assetUrl(asset.thumbUrl ?? asset.url);
        if (onUploadToCanvas) {
          onUploadToCanvas(asset.id, asset.url, asset.thumbUrl);
          setUploadPreviews((prev) =>
            [...prev, { id: asset.id, url: previewUrl }].slice(0, 4),
          );
        } else {
          setAssetIds((prev) => [...prev, asset.id].slice(0, 4));
          setUploadPreviews((prev) =>
            [...prev, { id: asset.id, url: previewUrl }].slice(0, 4),
          );
        }
      }
      for (const file of selectedFiles.slice(remaining)) {
        const asset = await uploadAsset(file, sessionId);
        const previewUrl =
          asset.url.startsWith("http") || asset.url.startsWith("blob:")
            ? asset.url
            : assetUrl(asset.thumbUrl ?? asset.url);
        if (onUploadToCanvas) {
          onUploadToCanvas(asset.id, asset.url, asset.thumbUrl);
          setUploadPreviews((prev) =>
            [...prev, { id: asset.id, url: previewUrl }].slice(0, 4),
          );
        } else {
          setAssetIds((prev) => [...prev, asset.id].slice(0, 4));
          setUploadPreviews((prev) =>
            [...prev, { id: asset.id, url: previewUrl }].slice(0, 4),
          );
        }
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
      uploadTargetRef.current = "general";
      setUploadTarget("general");
    }
  }
  handleUploadRef.current = handleUpload;

  function openUpload(target: "product" | "reference" | "general") {
    if (!sessionId) {
      onAuthRequired?.("会话未就绪，请刷新页面后重试");
      return;
    }
    if (homeDirectSubmit && !requireAuth("登录后即可上传参考图")) return;
    uploadTargetRef.current = target;
    setUploadTarget(target);
    fileRef.current?.click();
  }

  async function handlePromptReverse() {
    if (!sessionId) return;
    if (!requireAuth("登录后可使用图生文")) return;
    const assetId = assetIds[0];
    const imageUrl = uploadPreviews[0]?.url;
    if (!assetId && !imageUrl) {
      alert("请先上传参考图");
      return;
    }
    setReversing(true);
    try {
      const data = await reversePromptFromImage({
        sessionId,
        assetId,
        imageUrl: assetId ? undefined : imageUrl,
      });
      setPrompt(data.prompt);
      void trackEvent("prompt_reverse", { source: data.source });
    } catch (err) {
      alert(err instanceof Error ? err.message : "图生文失败");
    } finally {
      setReversing(false);
    }
  }

  function clearAttachmentState() {
    setAssetIds([]);
    setUploadPreviews([]);
    setProductAssetId(null);
    setReferenceAssetId(null);
    setSelectedRefs([]);
    setMentionedAssetIds([]);
    setMentionedAssetPreviews([]);
  }

  const mentionUploadedAssets = useMemo(() => {
    const fromStack = uploadPreviews
      .filter((preview) => assetIds.includes(preview.id))
      .map((preview, idx) => ({
        id: preview.id,
        url: preview.url,
        label: `上传图${idx + 1}`,
      }));
    if (creationLane !== "video" || videoReferenceMode !== "omni") {
      return fromStack;
    }
    const fromVideo = videoRefsToMentionCandidates(videoReferences);
    const seen = new Set(fromStack.map((a) => a.id));
    return [
      ...fromStack,
      ...fromVideo
        .filter((v) => !seen.has(v.assetId))
        .map((v) => ({ id: v.assetId, url: v.url, label: v.label })),
    ];
  }, [
    uploadPreviews,
    assetIds,
    creationLane,
    videoReferenceMode,
    videoReferences,
  ]);

  useEffect(() => {
    if (!restoredAssets?.length || !sessionId) return;
    setAssetIds(restoredAssets.map((a) => a.id));
    setUploadPreviews(
      restoredAssets
        .filter((a) => a.url)
        .map((a) => ({
          id: a.id,
          url:
            a.url.startsWith("blob:") || a.url.startsWith("http")
              ? a.url
              : assetUrl(a.url),
        })),
    );
  }, [restoredAssets, sessionId]);

  return {
    fileRef,
    uploadTargetRef,
    handleUploadRef,
    uploadTarget,
    assetIds,
    setAssetIds,
    productAssetId,
    setProductAssetId,
    referenceAssetId,
    setReferenceAssetId,
    uploading,
    selectedRefs,
    setSelectedRefs,
    mentionOpen,
    setMentionOpen,
    mentionQuery,
    setMentionQuery,
    mentionedAssetIds,
    setMentionedAssetIds,
    mentionedAssetPreviews,
    setMentionedAssetPreviews,
    uploadPreviews,
    setUploadPreviews,
    uploadPreviewIndex,
    setUploadPreviewIndex,
    reversing,
    buildReferenceSources,
    resolveProductAssetId,
    syncMentionStateFromPrompt,
    canvasReferenceActive,
    referenceChips,
    handleRemoveReferenceChip,
    insertMention,
    handleUpload,
    openUpload,
    handlePromptReverse,
    clearAttachmentState,
    mentionUploadedAssets,
  };
}
