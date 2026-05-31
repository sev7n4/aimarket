/**
 * 火山方舟 SeedEdit 图片编辑 Provider
 * 
 * 专门用于图片编辑场景，支持通过文本指令编辑图像。
 * SeedEdit 3.0 基于文生图模型 Seedream 3.0 训练，在图像主体、背景和细节保持能力方面表现突出。
 * 
 * OpenAI 标准接口：POST /images/edits
 * 火山方舟兼容接口：POST {ARK_BASE_URL}/images/generations
 * 
 * 文档：https://www.volcengine.com/docs/82379/1824691
 */
import type {
  EditParams,
  GenerateParams,
  GenerateResult,
  ImageProvider,
  ImageOperation,
} from "./types.js";
import { AppError } from "../lib/errors.js";

const SEEDEDIT_MODEL = "doubao-seededit-3-0-i2i-250628";

interface SeedEditApiResponse {
  data?: { url?: string; b64_json?: string }[];
  error?: { message?: string };
}

export const seededitProvider: ImageProvider = {
  name: "seededit",
  supports(modelId, operation) {
    if (!process.env.ARK_API_KEY?.trim()) return false;
    if (operation === "edit") {
      return modelId.includes("seededit") || modelId === "doubao-seededit";
    }
    return false;
  },
  async generate(params: GenerateParams): Promise<GenerateResult> {
    throw new AppError(
      400,
      "OPERATION_UNSUPPORTED",
      "SeedEdit provider 不支持 generate 操作，请使用 edit 操作",
    );
  },
  async edit(params: EditParams): Promise<GenerateResult> {
    const apiKey = process.env.ARK_API_KEY?.trim();
    if (!apiKey) throw new Error("ARK_API_KEY 未配置");

    const base = (
      process.env.ARK_BASE_URL ?? "https://ark.cn-beijing.volces.com/api/v3"
    ).replace(/\/$/, "");

    const model = process.env.SEEDEDIT_MODEL ?? SEEDEDIT_MODEL;

    const res = await fetch(`${base}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt: params.prompt.slice(0, 1000),
        image: params.image,
        size: "adaptive",
        n: Math.min(params.count, 4),
        response_format: "url",
        watermark: false,
      }),
      signal: AbortSignal.timeout(180_000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(
        `火山方舟 SeedEdit 失败 (${res.status}): ${errText.slice(0, 300)}`,
      );
    }

    const json = (await res.json()) as SeedEditApiResponse;
    if (json.error) {
      throw new Error(`SeedEdit 业务错误：${json.error.message ?? ""}`);
    }

    const urls = (json.data ?? [])
      .map((it) => it.url)
      .filter((u): u is string => typeof u === "string" && u.length > 0);

    if (urls.length === 0) {
      throw new Error("SeedEdit 返回缺少图片 URL");
    }

    return { urls, provider: "seededit" };
  },
};