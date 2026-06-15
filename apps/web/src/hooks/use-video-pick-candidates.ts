"use client";

import { useEffect, useMemo, useState } from "react";
import { registerAssetFromUrl } from "@/lib/api-client";
import type { CanvasItem } from "@/lib/canvas-tools";
import {
  resolveCanvasItemForVideoPick,
  type VideoPickCandidate,
} from "@/lib/canvas-video-reference-bind";
import type {
  CreationLane,
  VideoReferenceMode,
} from "@/lib/creation-dock-prefs";

type UploadPreview = { id: string; url: string };

/** 视频车道：将画布生成图（仅 outputId）登记为 asset，供三种参考模式槽位选择 */
export function useVideoPickCandidates(opts: {
  sessionId?: string;
  creationLane: CreationLane;
  canvasItems: CanvasItem[];
  uploadPreviews: UploadPreview[];
  videoReferenceMode: VideoReferenceMode;
}) {
  const [canvasPicks, setCanvasPicks] = useState<VideoPickCandidate[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (opts.creationLane !== "video" || !opts.sessionId) {
      setCanvasPicks([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void (async () => {
      const picks: VideoPickCandidate[] = [];
      for (const [index, item] of opts.canvasItems.entries()) {
        if (item.isVideo && opts.videoReferenceMode !== "omni") continue;
        try {
          const pick = await resolveCanvasItemForVideoPick(
            item,
            index,
            opts.sessionId!,
            registerAssetFromUrl,
          );
          if (pick) picks.push(pick);
        } catch {
          // 单条登记失败不阻塞其余候选
        }
      }
      if (!cancelled) {
        setCanvasPicks(picks);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    opts.canvasItems,
    opts.creationLane,
    opts.sessionId,
    opts.videoReferenceMode,
  ]);

  const candidates = useMemo((): VideoPickCandidate[] => {
    const seen = new Set<string>();
    const out: VideoPickCandidate[] = [];
    const push = (c: VideoPickCandidate | null) => {
      if (!c || seen.has(c.assetId)) return;
      seen.add(c.assetId);
      out.push(c);
    };
    for (const c of canvasPicks) push(c);
    for (const [uploadIdx, preview] of opts.uploadPreviews.entries()) {
      push({
        assetId: preview.id,
        previewUrl: preview.url,
        mediaType: "image",
        label: `上传图${uploadIdx + 1}`,
      });
    }
    return out;
  }, [canvasPicks, opts.uploadPreviews]);

  return { candidates, loading };
}
