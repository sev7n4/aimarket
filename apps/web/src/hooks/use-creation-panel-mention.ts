"use client";

import { useEffect } from "react";

import {
  canvasItemToMentionItem,
  type MentionItem,
} from "@/components/mention-picker";
import type { UploadPreviewItem } from "@/components/upload-preview-stack";
import { useVideoPickCandidates } from "@/hooks/use-video-pick-candidates";
import { registerAssetFromUrl } from "@/lib/api-client";
import type { CanvasItem, CanvasMaskSelection } from "@/lib/canvas-tools";
import {
  resolveCanvasItemForVideoPick,
  type VideoPickCandidate,
} from "@/lib/canvas-video-reference-bind";
import type {
  CreationLane,
  VideoReferenceMode,
} from "@/lib/creation-dock-prefs";

export type MentionItemRequest = {
  key: number;
  item: CanvasItem;
  promptSuffix?: string;
  maskSelection?: CanvasMaskSelection;
} | null;

export type UseCreationPanelMentionInput = {
  sessionId?: string;
  creationLane: CreationLane;
  canvasItems: CanvasItem[];
  uploadPreviews: UploadPreviewItem[];
  videoReferenceMode: VideoReferenceMode;
  mentionItemRequest: MentionItemRequest;
  insertMention: (mention: MentionItem, promptSuffix?: string) => void;
  applyVideoPickCandidate: (pick: VideoPickCandidate) => void;
  setMentionedMasks: React.Dispatch<React.SetStateAction<CanvasMaskSelection[]>>;
  onInteractionHint?: (hint: string) => void;
};

/** 视频 pick 候选 + 画布 @ 引用副作用：须在 assets / video hook 之后调用 */
export function useCreationPanelMention(input: UseCreationPanelMentionInput) {
  const {
    sessionId,
    creationLane,
    canvasItems,
    uploadPreviews,
    videoReferenceMode,
    mentionItemRequest,
    insertMention,
    applyVideoPickCandidate,
    setMentionedMasks,
    onInteractionHint,
  } = input;

  const { candidates: videoPickCandidates, loading: videoPickCandidatesLoading } =
    useVideoPickCandidates({
      sessionId,
      creationLane,
      canvasItems,
      uploadPreviews,
      videoReferenceMode,
    });

  useEffect(() => {
    if (!mentionItemRequest) return;
    const index = canvasItems.findIndex(
      (item) => item.id === mentionItemRequest.item.id,
    );
    const canvasItem = mentionItemRequest.item;

    if (creationLane === "video" && sessionId) {
      void (async () => {
        try {
          const pick = await resolveCanvasItemForVideoPick(
            canvasItem,
            index >= 0 ? index : 0,
            sessionId,
            registerAssetFromUrl,
          );
          if (!pick) return;
          applyVideoPickCandidate(pick);
          if (videoReferenceMode === "omni") {
            const mention = canvasItemToMentionItem(
              canvasItem,
              index >= 0 ? index : 0,
            );
            if (mention) {
              insertMention(mention, mentionItemRequest.promptSuffix ?? "");
            }
          }
          if (mentionItemRequest.maskSelection) {
            setMentionedMasks((prev) => [
              ...prev.filter((m) => m.id !== mentionItemRequest.maskSelection!.id),
              mentionItemRequest.maskSelection!,
            ]);
          }
        } catch (err) {
          onInteractionHint?.(
            err instanceof Error ? err.message : "引用到视频参考失败",
          );
        }
      })();
      return;
    }

    const mention = canvasItemToMentionItem(
      canvasItem,
      index >= 0 ? index : 0,
    );
    if (!mention) return;
    insertMention(mention, mentionItemRequest.promptSuffix ?? "");
    if (mentionItemRequest.maskSelection) {
      setMentionedMasks((prev) => [
        ...prev.filter((m) => m.id !== mentionItemRequest.maskSelection!.id),
        mentionItemRequest.maskSelection!,
      ]);
    }
    // 只响应外部请求 key，避免 canvasItems 刷新时重复插入同一 @ token。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mentionItemRequest?.key]);

  return { videoPickCandidates, videoPickCandidatesLoading };
}
