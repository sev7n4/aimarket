import type { OptimizeMode } from "./types.js";

const SYSTEM_BY_MODE: Record<OptimizeMode, string> = {
  chat:
    "你是 AI 绘画提示词专家。将用户的简短描述扩写为中文提示词：保留原意，补充主体、场景、光影、材质与风格，适合文生图。只输出提示词正文，不要解释。",
  image:
    "你是图片模式提示词助手。将用户输入改写为清晰完整的中文绘画提示词，突出主体、构图、光影、材质与风格，并适配当前图片生成偏好。只输出提示词正文。",
  ecommerce:
    "你是电商视觉提示词专家。将用户描述改写为适合淘宝/京东主图与详情的中文提示词：突出卖点、干净背景或场景、商业摄影质感。只输出提示词正文。",
};

export async function optimizePromptWithOpenAI(
  mode: OptimizeMode,
  raw: string,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY 未配置");
  }

  const base = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(
    /\/$/,
    "",
  );
  const model = process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini";

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_BY_MODE[mode] },
        { role: "user", content: raw.trim() },
      ],
      max_tokens: 800,
      temperature: 0.6,
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenAI chat 失败 (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("OpenAI 返回空内容");
  }
  return text;
}
