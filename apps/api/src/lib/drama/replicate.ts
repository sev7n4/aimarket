import { completeWithFallback, isAgentLlmEnabled } from "@aimarket/agent-core";
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

const REPLICATE_ANALYZE_JSON_SCHEMA = {
  type: "object",
  required: ["beatStructure"],
  properties: {
    title: { type: "string" },
    hook: { type: "string" },
    beatStructure: { type: "array", items: { type: "string" }, minItems: 3 },
    pacing: { type: "string" },
    suggestedDurationSec: { type: "number" },
    styleHints: { type: "array", items: { type: "string" } },
  },
} as const;

function envFlag(name: string, defaultValue = false): boolean {
  const v = process.env[name];
  if (v === undefined) return defaultValue;
  return v === "1" || v.toLowerCase() === "true";
}

function isReplicateVlmEnabled(): boolean {
  return Boolean(process.env.DASHSCOPE_API_KEY?.trim()) &&
    envFlag("DRAMA_REPLICATE_VLM_ENABLED", true);
}

function isLikelyDirectVideoUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return /\.(mp4|webm|mov|m4v|mkv)(\?|$)/.test(path);
  } catch {
    return false;
  }
}

function parseJsonFromLlmContent(content: string): Record<string, unknown> {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("LLM 未返回 JSON");
  }
  return JSON.parse(match[0]) as Record<string, unknown>;
}

function profileFromLlmPayload(
  videoUrl: string,
  parsed: Record<string, unknown>,
): ReplicateProfile {
  return replicateProfileSchema.parse({
    sourceUrl: videoUrl,
    title: parsed.title,
    hook: parsed.hook,
    beatStructure: parsed.beatStructure ?? [],
    pacing: parsed.pacing,
    suggestedDurationSec: parsed.suggestedDurationSec,
    styleHints: parsed.styleHints ?? [],
  });
}

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

/** 规则 / mock 分析（无 LLM/VLM 或回退） */
export function analyzeReferenceVideoMock(videoUrl: string): ReplicateProfile {
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

async function analyzeReferenceVideoWithLlm(
  videoUrl: string,
): Promise<ReplicateProfile> {
  const host = new URL(videoUrl).hostname.replace(/^www\./, "");
  const result = await completeWithFallback({
    messages: [
      {
        role: "system",
        content:
          "你是短视频结构分析师。根据参考视频链接（平台、路径、常见爆款模板）推断竖屏短剧结构。" +
          "输出 beatStructure 至少 3 条，suggestedDurationSec 取 15-180。只输出 JSON，不要 markdown。",
      },
      {
        role: "user",
        content: `参考视频：${videoUrl}\n来源域名：${host}`,
      },
    ],
    jsonSchema: REPLICATE_ANALYZE_JSON_SCHEMA,
    temperature: 0.35,
    maxTokens: 2048,
  });
  return profileFromLlmPayload(videoUrl, parseJsonFromLlmContent(result.content));
}

async function analyzeReferenceVideoWithVlm(
  videoUrl: string,
): Promise<ReplicateProfile> {
  const apiKey = process.env.DASHSCOPE_API_KEY?.trim();
  if (!apiKey) throw new Error("DASHSCOPE_API_KEY missing");

  const base =
    process.env.DASHSCOPE_LLM_BASE_URL ??
    "https://dashscope.aliyuncs.com/compatible-mode/v1";
  const model = process.env.AGENT_VLM_QWEN_MODEL ?? "qwen-vl-max-latest";

  const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "video_url", video_url: { url: videoUrl } },
            {
              type: "text",
              text:
                "分析该参考短视频的结构节拍、开场钩子、节奏与画幅风格。" +
                '仅输出 JSON：{"title":"string","hook":"string","beatStructure":["string"],"pacing":"string","suggestedDurationSec":number,"styleHints":["string"]}，' +
                "beatStructure 至少 3 条。",
            },
          ],
        },
      ],
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Replicate VLM HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content ?? "";
  return profileFromLlmPayload(videoUrl, parseJsonFromLlmContent(content));
}

/** 分析参考视频 URL，提取复刻结构（VLM → LLM → mock 回退） */
export async function analyzeReferenceVideo(
  videoUrl: string,
): Promise<ReplicateProfile> {
  const parsed = z.string().url().parse(videoUrl);

  if (isReplicateVlmEnabled() && isLikelyDirectVideoUrl(parsed)) {
    try {
      return await analyzeReferenceVideoWithVlm(parsed);
    } catch (err) {
      console.warn("[drama-replicate] VLM analyze failed, fallback:", err);
    }
  }

  if (isAgentLlmEnabled()) {
    try {
      return await analyzeReferenceVideoWithLlm(parsed);
    } catch (err) {
      console.warn("[drama-replicate] LLM analyze failed, fallback:", err);
    }
  }

  return analyzeReferenceVideoMock(parsed);
}
