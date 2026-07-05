import { buildOptimizeSystemPrompt, dedupeCandidates } from "./context.js";
import type { OptimizeMode, PromptOptimizeContext } from "./types.js";

export async function optimizePromptWithOpenAI(
  mode: OptimizeMode,
  raw: string,
  context?: PromptOptimizeContext,
  candidateCount = 1,
): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY 未配置");
  }

  const base = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(
    /\/$/,
    "",
  );
  const model = process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini";
  const n = Math.max(1, candidateCount);

  const res = await fetch(`${base}/chat/completions`, {
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
      // 多候选时提高温度以增加差异性
      temperature: n > 1 ? 0.9 : 0.6,
      ...(n > 1 ? { n } : {}),
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
  const texts = dedupeCandidates(
    (data.choices ?? []).map((c) => c.message?.content?.trim() ?? ""),
  );
  if (texts.length === 0) {
    throw new Error("OpenAI 返回空内容");
  }
  return texts;
}
