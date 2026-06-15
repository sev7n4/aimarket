import type { CharacterAuditInput, CharacterAuditResult } from "./character-audit.js";

const DEFAULT_MODEL = "qwen-vl-max-latest";

/** Qwen-VL 短剧角色/风格一致性打分（0–100） */
export async function runQwenDramaCharacterAudit(
  input: CharacterAuditInput,
): Promise<CharacterAuditResult> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new Error("DASHSCOPE_API_KEY missing");
  }

  const charMin = input.characterMinScore ?? 75;
  const styleMin = input.styleMinScore ?? 70;

  const base =
    process.env.DASHSCOPE_LLM_BASE_URL ??
    "https://dashscope.aliyuncs.com/compatible-mode/v1";
  const model = process.env.AGENT_VLM_QWEN_MODEL ?? DEFAULT_MODEL;

  const imageContents = [
    {
      type: "text",
      text:
        "【参考图】以下为角色/场景定稿参考（Anchor First）：",
    },
    ...input.referenceUrls.slice(0, 3).map((url) => ({
      type: "image_url" as const,
      image_url: { url },
    })),
    {
      type: "text",
      text: "【待审关键帧】请与参考图对比：",
    },
    {
      type: "image_url",
      image_url: { url: input.generatedUrl },
    },
    {
      type: "text",
      text:
        `风格约束：${input.styleBiblePrompt.slice(0, 800)}\n` +
        "请评估待审关键帧与参考图的角色一致性（面部、服装、体型）和全片风格一致性（光影、色板）。" +
        '仅输出 JSON：{"characterScore":0-100,"styleScore":0-100,"reason":"简短中文"}',
    },
  ];

  const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: imageContents }],
      temperature: 0.1,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Drama VLM HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content ?? "";
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("Drama VLM 无 JSON 输出");
  }

  const parsed = JSON.parse(match[0]) as {
    characterScore?: number;
    styleScore?: number;
    reason?: string;
  };

  const characterScore = clampScore(parsed.characterScore, 70);
  const styleScore = clampScore(parsed.styleScore, 70);
  const pass = characterScore >= charMin && styleScore >= styleMin;

  return {
    pass,
    heroIndex: 0,
    characterScore,
    styleScore,
    reason: pass
      ? parsed.reason ?? `角色 ${characterScore} / 风格 ${styleScore}`
      : parsed.reason ??
        `一致性不足：角色 ${characterScore}（需≥${charMin}），风格 ${styleScore}（需≥${styleMin}）`,
    provider: "vlm-qwen-drama",
  };
}

function clampScore(v: number | undefined, fallback: number): number {
  if (typeof v !== "number" || Number.isNaN(v)) return fallback;
  return Math.max(0, Math.min(100, Math.round(v)));
}
