import type { CanvasItem } from "@/lib/canvas-tools";
import type {
  SmartMultiShot,
  VideoMediaRef,
  VideoMediaType,
  VideoReferenceMode,
} from "@/lib/creation-dock-prefs";
import { assignOmniRefLabels } from "@/lib/video-mention";

export type VideoPickCandidate = {
  assetId: string;
  previewUrl: string;
  mediaType: VideoMediaType;
  label?: string;
};

function inferMediaTypeFromCanvasItem(item: CanvasItem): VideoMediaType {
  if (item.isVideo) return "video";
  if (/\.(mp3|wav|m4a|ogg|aac)(\?|$)/i.test(item.url)) return "audio";
  return "image";
}

export function canvasItemToVideoPickCandidate(
  item: CanvasItem,
  index: number,
): VideoPickCandidate | null {
  if (!item.assetId) return null;
  return {
    assetId: item.assetId,
    previewUrl: item.url,
    mediaType: inferMediaTypeFromCanvasItem(item),
    label: item.label ?? `图${index + 1}`,
  };
}

export function routePickToVideoSlots(
  pick: VideoPickCandidate,
  mode: VideoReferenceMode,
  videoReferences: VideoMediaRef[],
  smartMultiShots: SmartMultiShot[],
  activeShotIndex = 0,
): { videoReferences: VideoMediaRef[]; smartMultiShots: SmartMultiShot[] } {
  const baseRef: VideoMediaRef = {
    assetId: pick.assetId,
    mediaType: pick.mediaType,
    previewUrl: pick.previewUrl,
    label: pick.label,
  };

  if (mode === "omni") {
    if (videoReferences.some((r) => r.assetId === pick.assetId)) {
      return { videoReferences, smartMultiShots };
    }
    if (videoReferences.length >= 12) return { videoReferences, smartMultiShots };
    return {
      videoReferences: assignOmniRefLabels([
        ...videoReferences,
        { ...baseRef, role: "reference" },
      ]),
      smartMultiShots,
    };
  }

  if (mode === "first-last") {
    const refs = [...videoReferences];
    const hasFirst = refs.some((r) => r.role === "first_frame");
    const hasLast = refs.some((r) => r.role === "last_frame");
    if (pick.mediaType === "image") {
      if (!hasFirst) {
        refs.push({ ...baseRef, role: "first_frame" });
      } else if (!hasLast) {
        refs.push({ ...baseRef, role: "last_frame" });
      }
    } else if (!hasFirst) {
      refs.push({ ...baseRef, role: "first_frame" });
    }
    return { videoReferences: refs, smartMultiShots };
  }

  const shots =
    smartMultiShots.length > 0
      ? [...smartMultiShots]
      : [
          { order: 0, motionPrompt: "" },
          { order: 1, motionPrompt: "" },
        ];
  const idx = Math.min(Math.max(activeShotIndex, 0), shots.length - 1);
  shots[idx] = {
    ...shots[idx]!,
    assetId: pick.assetId,
    previewUrl: pick.previewUrl,
  };
  return { videoReferences, smartMultiShots: shots };
}

export async function resolveCanvasItemForVideoPick(
  item: CanvasItem,
  index: number,
  sessionId: string,
  registerUrl: (body: {
    sessionId: string;
    url: string;
    fileName?: string;
  }) => Promise<{ id: string; url: string; mimeType: string }>,
): Promise<VideoPickCandidate | null> {
  const direct = canvasItemToVideoPickCandidate(item, index);
  if (direct) return direct;
  if (!item.url) return null;
  const data = await registerUrl({
    sessionId,
    url: item.url,
    fileName: item.label,
  });
  const mediaType: VideoMediaType = data.mimeType.startsWith("audio/")
    ? "audio"
    : data.mimeType.startsWith("video/")
      ? "video"
      : "image";
  return {
    assetId: data.id,
    previewUrl: data.url,
    mediaType,
    label: item.label ?? `图${index + 1}`,
  };
}
