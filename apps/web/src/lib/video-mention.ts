import type { VideoMediaRef, VideoMediaType } from "./creation-dock-prefs";
import { extractMentionLabelsFromPrompt } from "./mention-sync";

/** 全能参考 @ 标签前缀（对标即梦 @Image1 / @Video1） */
export function defaultOmniRefLabel(
  mediaType: VideoMediaType,
  indexWithinType: number,
): string {
  const prefix =
    mediaType === "image" ? "图片" : mediaType === "video" ? "视频" : "音频";
  return `${prefix}${indexWithinType + 1}`;
}

/** 为 omni 参考素材分配稳定 @ 标签 */
export function assignOmniRefLabels(refs: VideoMediaRef[]): VideoMediaRef[] {
  const counters: Record<VideoMediaType, number> = {
    image: 0,
    video: 0,
    audio: 0,
  };
  return refs.map((ref) => {
    const idx = counters[ref.mediaType];
    counters[ref.mediaType] = idx + 1;
    return {
      ...ref,
      label: ref.label ?? defaultOmniRefLabel(ref.mediaType, idx),
    };
  });
}

export type VideoMentionCandidate = {
  assetId: string;
  label: string;
  url: string;
  mediaType: VideoMediaType;
};

export function videoRefsToMentionCandidates(
  refs: VideoMediaRef[],
): VideoMentionCandidate[] {
  return assignOmniRefLabels(refs)
    .filter((r) => Boolean(r.previewUrl))
    .map((r) => ({
      assetId: r.assetId,
      label: r.label!,
      url: r.previewUrl!,
      mediaType: r.mediaType,
    }));
}

export function filterVideoRefsByPromptLabels(
  refs: VideoMediaRef[],
  labelsInPrompt: string[],
): VideoMediaRef[] {
  const labeled = assignOmniRefLabels(refs);
  return labeled.filter(
    (ref) => ref.label != null && labelsInPrompt.includes(ref.label),
  );
}

export type OmniMentionValidation = {
  ok: boolean;
  message?: string;
};

/** omni 模式：已上传素材须在 prompt 中用 @ 引用（至少一条） */
export function validateOmniVideoMentions(
  prompt: string,
  refs: VideoMediaRef[],
): OmniMentionValidation {
  if (!refs.length) return { ok: true };
  const labels = extractMentionLabelsFromPrompt(prompt);
  const labeled = assignOmniRefLabels(refs);
  const refLabels = labeled.map((r) => r.label).filter(Boolean) as string[];
  const mentionedRefs = refLabels.filter((l) => labels.includes(l));
  if (refs.length > 0 && mentionedRefs.length === 0) {
    return {
      ok: false,
      message: `全能参考已上传 ${refs.length} 条素材，请在描述中用 @${refLabels[0]} 等引用并说明作用`,
    };
  }
  const unknown = labels.filter(
    (l) =>
      /^(图片|视频|音频)\d+$/.test(l) && !refLabels.includes(l),
  );
  if (unknown.length) {
    return {
      ok: false,
      message: `描述中的 @${unknown[0]} 未找到对应上传素材，请检查引用名称`,
    };
  }
  return { ok: true };
}
