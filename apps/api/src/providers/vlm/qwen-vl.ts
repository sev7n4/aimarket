import type { VlmProvider, VlmQualityInput, VlmQualityResult } from "./types.js";

const DEFAULT_MODEL = "qwen-vl-max-latest";

export const vlmQwenProvider: VlmProvider = {
  name: "vlm-qwen",
  supports: () => Boolean(process.env.DASHSCOPE_API_KEY),
  async checkQuality(input: VlmQualityInput): Promise<VlmQualityResult> {
    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) {
      throw new Error("DASHSCOPE_API_KEY missing");
    }

    const base =
      process.env.DASHSCOPE_LLM_BASE_URL ??
      "https://dashscope.aliyuncs.com/compatible-mode/v1";
    const model = process.env.AGENT_VLM_QWEN_MODEL ?? DEFAULT_MODEL;

    const imageUrl = input.urls[0];
    const body = {
      model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
            {
              type: "text",
              text:
                `你是电商出图质检。产品描述：${input.prompt.slice(0, 500)}\n` +
                "请判断图片是否可用于电商主图（清晰、主体完整、与描述一致）。" +
                '仅输出 JSON：{"pass":true|false,"heroIndex":0,"reason":"简短中文"}',
            },
          ],
        },
      ],
      temperature: 0.2,
    };

    const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`VLM HTTP ${res.status}: ${text.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content ?? "";
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) {
      return {
        pass: true,
        heroIndex: 0,
        reason: "VLM 无 JSON，默认通过",
        provider: "vlm-qwen",
      };
    }

    const parsed = JSON.parse(match[0]) as {
      pass?: boolean;
      heroIndex?: number;
      reason?: string;
    };

    return {
      pass: Boolean(parsed.pass),
      heroIndex:
        typeof parsed.heroIndex === "number" && parsed.heroIndex >= 0
          ? parsed.heroIndex
          : 0,
      reason: parsed.reason,
      provider: "vlm-qwen",
    };
  },
};
