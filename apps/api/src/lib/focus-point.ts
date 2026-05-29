import {
  type FocusPointBody,
  newFocusPointId,
} from "./focus.js";

export interface FocusPointResult {
  pointId: string;
  objectName: string;
  provider: string;
}

const MOCK_NAMES = [
  "目标物体",
  "选中区域",
  "主体",
  "文字区域",
  "商品",
];

const FOCUS_VISION_MODEL =
  process.env.FOCUS_VISION_MODEL ?? "qwen-vl-plus";

/**
 * 焦点识别（mock | DashScope 视觉 | 回落 mock）
 */
export async function recognizeFocusPoint(
  body: FocusPointBody,
): Promise<FocusPointResult> {
  const mode = (process.env.FOCUS_POINT_PROVIDER ?? "auto").toLowerCase();
  if (mode === "mock") {
    return mockRecognize(body);
  }

  if (
    (mode === "vision" || mode === "auto") &&
    process.env.DASHSCOPE_API_KEY?.trim()
  ) {
    try {
      return await visionRecognize(body);
    } catch (err) {
      console.warn("[focus-point] vision 失败，回落 mock", err);
    }
  }

  return mockRecognize(body);
}

function mockRecognize(body: FocusPointBody): FocusPointResult {
  const idx =
    body.x != null && body.y != null
      ? Math.floor((body.x + body.y) * MOCK_NAMES.length) %
        MOCK_NAMES.length
      : 0;
  return {
    pointId: newFocusPointId(),
    objectName: MOCK_NAMES[idx] ?? "目标物体",
    provider: "focus-mock",
  };
}

function resolveVisionImageUrl(body: FocusPointBody): string | null {
  if (body.imageUrl?.trim()) return body.imageUrl.trim();
  const b64 = body.imageBase64?.trim();
  if (!b64) return null;
  if (b64.startsWith("data:")) return b64;
  return `data:image/png;base64,${b64}`;
}

/** 通义千问 VL：描述点击处附近物体（2–8 字） */
async function visionRecognize(
  body: FocusPointBody,
): Promise<FocusPointResult> {
  const apiKey = process.env.DASHSCOPE_API_KEY?.trim();
  if (!apiKey) return mockRecognize(body);

  const imageUrl = resolveVisionImageUrl(body);
  if (!imageUrl) return mockRecognize(body);

  const base = (
    process.env.DASHSCOPE_BASE_URL ?? "https://dashscope.aliyuncs.com"
  ).replace(/\/$/, "");

  const posHint =
    body.x != null && body.y != null
      ? `用户点击位置约在画面横向 ${Math.round(body.x * 100)}%、纵向 ${Math.round(body.y * 100)}% 处。`
      : "";

  const res = await fetch(`${base}/compatible-mode/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: FOCUS_VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageUrl } },
            {
              type: "text",
              text: `${posHint}请用 2–8 个汉字说出点击位置附近最主要的物体或文字区域名称，不要解释、不要标点。`,
            },
          ],
        },
      ],
      max_tokens: 32,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `DashScope VL 失败 (${res.status}): ${errText.slice(0, 200)}`,
    );
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };
  if (json.error?.message) {
    throw new Error(json.error.message);
  }

  const raw = json.choices?.[0]?.message?.content?.trim() ?? "";
  const objectName =
    raw
      .replace(/[「」"'`\n]/g, "")
      .slice(0, 24)
      .trim() || "目标区域";

  return {
    pointId: newFocusPointId(),
    objectName,
    provider: "focus-vision",
  };
}

export function getFocusPointProviderStatus() {
  const mode = (process.env.FOCUS_POINT_PROVIDER ?? "auto").toLowerCase();
  const dashscopeConfigured = Boolean(process.env.DASHSCOPE_API_KEY?.trim());
  const active =
    mode === "mock"
      ? "focus-mock"
      : mode === "vision" && dashscopeConfigured
        ? "focus-vision"
        : mode === "auto" && dashscopeConfigured
          ? "focus-vision"
          : "focus-mock";
  return {
    mode,
    activeProvider: active,
    dashscopeConfigured,
    visionModel: FOCUS_VISION_MODEL,
  };
}
