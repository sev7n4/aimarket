import { z } from "zod";

export const replicateProfileSchema = z.object({
  sourceUrl: z.string().url(),
  title: z.string().optional(),
  hook: z.string().optional(),
  beatStructure: z.array(z.string()).default([]),
  pacing: z.string().optional(),
  suggestedDurationSec: z.number().int().min(15).max(180).optional(),
  styleHints: z.array(z.string()).default([]),
});

export type ReplicateProfile = z.infer<typeof replicateProfileSchema>;

/** 将复刻画像注入规划 prompt */
export function formatReplicateProfileForPlanner(profile: ReplicateProfile): string {
  const beats =
    profile.beatStructure.length > 0
      ? profile.beatStructure.map((b, i) => `${i + 1}. ${b}`).join("\n")
      : "（未识别分节）";
  const styles =
    profile.styleHints.length > 0 ? profile.styleHints.join("、") : "快节奏竖屏";
  return [
    `[爆款复刻参考] ${profile.sourceUrl}`,
    profile.title ? `原标题：${profile.title}` : null,
    profile.hook ? `开场钩子：${profile.hook}` : null,
    `节奏：${profile.pacing ?? "紧凑"}`,
    `建议时长：${profile.suggestedDurationSec ?? 90}s`,
    `风格：${styles}`,
    "结构节拍：",
    beats,
    "请在保留上述结构与节奏的前提下，用新的 userIdea 重述故事。",
  ]
    .filter(Boolean)
    .join("\n");
}

/** 分析参考视频 URL，提取复刻结构（mock / 规则） */
export async function analyzeReferenceVideo(
  videoUrl: string,
): Promise<ReplicateProfile> {
  const parsed = z.string().url().parse(videoUrl);
  const host = new URL(parsed).hostname.replace(/^www\./, "");

  return replicateProfileSchema.parse({
    sourceUrl: parsed,
    title: `复刻自 ${host}`,
    hook: "前三秒强冲突或悬念镜头",
    beatStructure: [
      "0-3s 强钩子",
      "3-15s 人物/场景建立",
      "15-45s 冲突升级",
      "45-75s 反转或高潮",
      "75-90s 情绪收束与 CTA",
    ],
    pacing: "快切竖屏",
    suggestedDurationSec: 90,
    styleHints: ["竖屏 9:16", "近景为主", "高对比调色"],
  });
}
