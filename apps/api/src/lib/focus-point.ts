import sharp from "sharp";
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

const DEFAULT_CROP_SIZE = 128;
const MIN_CROP_SIZE = 64;
const MAX_CROP_SIZE = 256;

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

async function cropImageRegion(
  imageUrl: string,
  x: number,
  y: number,
  cropSize: number,
): Promise<string> {
  let imageBuffer: Buffer;

  if (imageUrl.startsWith("data:")) {
    const base64Match = imageUrl.match(/^data:image\/\w+;base64,(.+)$/);
    if (!base64Match) {
      throw new Error("无效的 base64 图片格式");
    }
    imageBuffer = Buffer.from(base64Match[1], "base64");
  } else {
    const res = await fetch(imageUrl);
    if (!res.ok) {
      throw new Error(`获取图片失败: ${res.status}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    imageBuffer = Buffer.from(arrayBuffer);
  }

  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (width === 0 || height === 0) {
    throw new Error("无法获取图片尺寸");
  }

  const clampedCropSize = Math.max(MIN_CROP_SIZE, Math.min(MAX_CROP_SIZE, cropSize));

  const centerX = Math.round(x * width);
  const centerY = Math.round(y * height);

  const halfSize = Math.round(clampedCropSize / 2);
  let left = centerX - halfSize;
  let top = centerY - halfSize;

  left = Math.max(0, Math.min(width - clampedCropSize, left));
  top = Math.max(0, Math.min(height - clampedCropSize, top));

  const croppedBuffer = await sharp(imageBuffer)
    .extract({
      left,
      top,
      width: clampedCropSize,
      height: clampedCropSize,
    })
    .jpeg({ quality: 85 })
    .toBuffer();

  return `data:image/jpeg;base64,${croppedBuffer.toString("base64")}`;
}

async function visionRecognize(
  body: FocusPointBody,
): Promise<FocusPointResult> {
  const apiKey = process.env.DASHSCOPE_API_KEY?.trim();
  if (!apiKey) return mockRecognize(body);

  const rawImageUrl = resolveVisionImageUrl(body);
  if (!rawImageUrl) return mockRecognize(body);

  const base = (
    process.env.DASHSCOPE_BASE_URL ?? "https://dashscope.aliyuncs.com"
  ).replace(/\/$/, "");

  let visionImageUrl = rawImageUrl;
  let posHint = "";

  if (body.x != null && body.y != null) {
    const cropSize = body.cropSize ?? DEFAULT_CROP_SIZE;
    try {
      visionImageUrl = await cropImageRegion(rawImageUrl, body.x, body.y, cropSize);
      posHint = `这是图片中点击位置附近的局部区域（裁剪尺寸 ${cropSize}px），请识别其中的主要物体或文字。`;
    } catch (err) {
      console.warn("[focus-point] 裁剪失败，使用原图", err);
      posHint = `用户点击位置约在画面横向 ${Math.round(body.x * 100)}%、纵向 ${Math.round(body.y * 100)}% 处。`;
    }
  }

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
            { type: "image_url", image_url: { url: visionImageUrl } },
            {
              type: "text",
              text: `${posHint}请用 2–8 个汉字说出图中最主要的物体或文字区域名称，不要解释、不要标点。`,
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
    defaultCropSize: DEFAULT_CROP_SIZE,
  };
}