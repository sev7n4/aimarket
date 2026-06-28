/**
 * 多机位宫格工具 Provider
 *
 * 包含两个工具：
 *   - multi-cam-9:  9宫格，9个固定机位 prompt 模板
 *   - multi-cam-25: 25宫格，LLM 拆解场景为25个连贯镜头
 *
 * 两者均复用 generateImages 批量生图。
 */
import { generateImages } from "../registry.js";
import { resolveImageDimensions } from "../../lib/image-size.js";
import type { ImageToolProvider, ToolRunParams, ToolRunResult } from "./types.js";

/* ========== 9 宫格：固定机位 prompt 模板 ========== */

/** 9 个机位定义：中文名 / 英文 prompt 增强 */
const MULTI_CAM_9_ANGLES = [
  { label: "俯拍",   suffix: "overhead top-down shot, looking straight down from above" },
  { label: "仰拍",   suffix: "low angle shot, looking up from below" },
  { label: "左45°",  suffix: "left 45-degree angle shot, three-quarter view from the left" },
  { label: "右45°",  suffix: "right 45-degree angle shot, three-quarter view from the right" },
  { label: "正面",   suffix: "front view, directly facing the camera" },
  { label: "背面",   suffix: "rear view, from behind the subject" },
  { label: "近景",   suffix: "close-up shot, medium close-up framing" },
  { label: "远景",   suffix: "wide establishing shot, full scene context" },
  { label: "特写",   suffix: "extreme close-up detail shot, macro framing on specific detail" },
] as const;

/**
 * 为 9 个机位生成增强 prompt
 * @param basePrompt 用户原始 prompt
 * @returns 9 个增强后的 prompt
 */
export function generateMultiCam9Prompts(basePrompt: string): string[] {
  return MULTI_CAM_9_ANGLES.map(
    (angle) => `${basePrompt}, ${angle.suffix}`,
  );
}

/* ========== 25 宫格：LLM 拆解连贯镜头 ========== */

interface LlmChatChoice {
  message?: { content?: string };
}

/**
 * 调用 LLM 将场景拆解为 25 个连贯镜头描述
 * @param sceneDescription 场景描述
 * @returns 25 个镜头 prompt
 */
export async function generateMultiCam25Prompts(
  sceneDescription: string,
): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    // 未配置 LLM 时回退到模板拆分
    return fallbackMultiCam25Prompts(sceneDescription);
  }

  const base = (
    process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1"
  ).replace(/\/$/, "");
  const model = process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini";

  const systemPrompt =
    "你是一位专业电影分镜师。将以下场景拆解为25个连贯的电影镜头，每个镜头包含景别、角度、动作描述。" +
    "请严格输出25行，每行一个镜头描述，不要编号，不要额外说明。";

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: sceneDescription },
      ],
      max_tokens: 2000,
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.warn(
      `[multi-cam-25] LLM 拆解失败 (${res.status}): ${errText.slice(0, 200)}`,
    );
    return fallbackMultiCam25Prompts(sceneDescription);
  }

  const data = (await res.json()) as { choices?: LlmChatChoice[] };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    return fallbackMultiCam25Prompts(sceneDescription);
  }

  const lines = text
    .split("\n")
    .map((l) => l.replace(/^\d+[\.\)、]\s*/, "").trim())
    .filter(Boolean);

  // 不足 25 条则用模板补齐，超过则截断
  if (lines.length < 25) {
    const fallback = fallbackMultiCam25Prompts(sceneDescription);
    while (lines.length < 25) {
      lines.push(fallback[lines.length] ?? fallback[fallback.length - 1]!);
    }
  }

  return lines.slice(0, 25);
}

/** 无 LLM 时的模板回退：用 5 个阶段 × 5 个角度 */
function fallbackMultiCam25Prompts(sceneDescription: string): string[] {
  const stages = ["开场引入", "发展推进", "冲突高潮", "转折过渡", "收尾结局"];
  const angles = [
    "establishing wide shot",
    "medium shot",
    "close-up reaction",
    "over-the-shoulder",
    "low angle dramatic",
  ];
  const prompts: string[] = [];
  for (const stage of stages) {
    for (const angle of angles) {
      prompts.push(
        `${sceneDescription}, ${stage}阶段, ${angle}`,
      );
    }
  }
  return prompts;
}

/* ========== MultiCam9ToolProvider ========== */

export const multiCam9ToolProvider: ImageToolProvider = {
  name: "tool-multi-cam-9",
  supports(toolId: string) {
    return toolId === "multi-cam-9";
  },
  async run(params: ToolRunParams): Promise<ToolRunResult> {
    const prompts = generateMultiCam9Prompts(params.prompt);
    const [w, h] = resolveImageDimensions(params.resolution, params.aspectRatio ?? "1:1");

    // 并发生成 9 张图
    const results = await Promise.all(
      prompts.map((prompt) =>
        generateImages({
          prompt,
          modelId: params.modelId,
          count: 1,
          resolution: params.resolution,
          aspectRatio: params.aspectRatio,
          referenceUrls: params.referenceUrls.length > 0 ? [params.referenceUrls[0]!] : undefined,
          userId: params.userId,
        }),
      ),
    );

    const urls = results.flatMap((r) => r.urls);
    return {
      urls,
      provider: "tool-multi-cam-9",
      width: w,
      height: h,
    };
  },
};

/* ========== MultiCam25ToolProvider ========== */

export const multiCam25ToolProvider: ImageToolProvider = {
  name: "tool-multi-cam-25",
  supports(toolId: string) {
    return toolId === "multi-cam-25";
  },
  async run(params: ToolRunParams): Promise<ToolRunResult> {
    const prompts = await generateMultiCam25Prompts(params.prompt);
    const [w, h] = resolveImageDimensions(params.resolution, params.aspectRatio ?? "1:1");

    // 并发生成 25 张图（分 5 批，每批 5 张，避免瞬间并发过高）
    const BATCH_SIZE = 5;
    const urls: string[] = [];
    for (let i = 0; i < prompts.length; i += BATCH_SIZE) {
      const batch = prompts.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map((prompt) =>
          generateImages({
            prompt,
            modelId: params.modelId,
            count: 1,
            resolution: params.resolution,
            aspectRatio: params.aspectRatio,
            referenceUrls: params.referenceUrls.length > 0 ? [params.referenceUrls[0]!] : undefined,
            userId: params.userId,
          }),
        ),
      );
      urls.push(...batchResults.flatMap((r) => r.urls));
    }

    return {
      urls,
      provider: "tool-multi-cam-25",
      width: w,
      height: h,
    };
  },
};
