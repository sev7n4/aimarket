import { buildOptimizeSystemPrompt } from "./context.js";
import type { OptimizeMode, PromptOptimizeContext } from "./types.js";

export async function optimizePromptWithDashScope(
  mode: OptimizeMode,
  raw: string,
  context?: PromptOptimizeContext,
): Promise<string> {
  const apiKey = process.env.DASHSCOPE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("DASHSCOPE_API_KEY 未配置");
  }

  const base = (
    process.env.DASHSCOPE_BASE_URL ?? "https://dashscope.aliyuncs.com"
  ).replace(/\/$/, "");
  const model =
    process.env.PROMPT_OPTIMIZE_DASHSCOPE_MODEL?.trim() ?? "qwen-plus";

  const res = await fetch(`${base}/compatible-mode/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: buildOptimizeSystemPrompt(mode, context),
        },
        { role: "user", content: raw.trim() },
      ],
      max_tokens: 800,
      temperature: 0.6,
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `DashScope chat 失败 (${res.status}): ${errText.slice(0, 200)}`,
    );
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("DashScope 返回空内容");
  }
  return text;
}
