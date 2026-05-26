import { getModel } from "../lib/models.js";
import { persistOutputUrls } from "../lib/persist-output.js";
import { AppError } from "../lib/errors.js";
import { aliyunWanProvider } from "./aliyun-wan.js";
import { mockProvider } from "./mock.js";
import { openaiProvider } from "./openai.js";
import type { GenerateParams, GenerateResult, ImageProvider } from "./types.js";

/** auto 模式下优先级：aliyun_wan（国内）→ openai → mock */
const providers = [aliyunWanProvider, openaiProvider, mockProvider];

export function resolveProvider(modelId: string): ImageProvider {
  const mode = process.env.IMAGE_PROVIDER ?? "auto";

  if (mode === "mock") return mockProvider;

  if (mode === "openai") {
    if (!process.env.OPENAI_API_KEY) {
      throw new AppError(
        503,
        "PROVIDER_UNAVAILABLE",
        "请配置 OPENAI_API_KEY 后使用 openai 模式",
      );
    }
    if (!openaiProvider.supports(modelId)) {
      throw new AppError(
        400,
        "MODEL_UNSUPPORTED",
        `当前模型 ${modelId} 不支持 OpenAI 出图`,
      );
    }
    return openaiProvider;
  }

  if (mode === "aliyun_wan") {
    if (!process.env.DASHSCOPE_API_KEY) {
      throw new AppError(
        503,
        "PROVIDER_UNAVAILABLE",
        "请配置 DASHSCOPE_API_KEY 后使用 aliyun_wan 模式",
      );
    }
    if (!aliyunWanProvider.supports(modelId)) {
      throw new AppError(
        400,
        "MODEL_UNSUPPORTED",
        `当前模型 ${modelId} 不支持 阿里百炼 wan 出图`,
      );
    }
    return aliyunWanProvider;
  }

  for (const p of providers) {
    if (p.supports(modelId)) return p;
  }
  return mockProvider;
}

export async function generateImages(
  params: GenerateParams,
): Promise<GenerateResult & { modelName?: string }> {
  const provider = resolveProvider(params.modelId);
  const result = await provider.generate(params);
  const urls = await persistOutputUrls(result.urls);
  const meta = getModel(params.modelId);
  return { ...result, urls, modelName: meta?.name };
}

export function getProviderStatus() {
  const mode = process.env.IMAGE_PROVIDER ?? "auto";
  const openaiConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());
  const aliyunWanConfigured = Boolean(process.env.DASHSCOPE_API_KEY?.trim());
  const activeProvider = resolveProvider("omni-v2").name;
  const usingMock = activeProvider === "mock";

  let hint: string;
  if (mode === "openai" && !openaiConfigured) {
    hint = "已强制 openai 模式但未配置 OPENAI_API_KEY，生成将失败";
  } else if (mode === "aliyun_wan" && !aliyunWanConfigured) {
    hint = "已强制 aliyun_wan 模式但未配置 DASHSCOPE_API_KEY，生成将失败";
  } else if (usingMock && (openaiConfigured || aliyunWanConfigured)) {
    hint =
      "已配置 Key，但当前模型回落 Mock；可设置 IMAGE_PROVIDER=openai/aliyun_wan";
  } else if (usingMock) {
    hint =
      "演示模式：使用 Mock 占位图，配置 DASHSCOPE_API_KEY 或 OPENAI_API_KEY 可启用真实出图";
  } else if (activeProvider === "aliyun-wan") {
    hint = `真实出图：阿里百炼 ${process.env.ALIYUN_WAN_MODEL ?? "wan2.6-t2i"}`;
  } else {
    hint = "真实出图：OpenAI Images API";
  }

  return {
    mode,
    openaiConfigured,
    openaiBaseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    openaiImageModel: process.env.OPENAI_IMAGE_MODEL ?? "(按模型自动)",
    aliyunWanConfigured,
    aliyunWanBaseUrl:
      process.env.DASHSCOPE_BASE_URL ?? "https://dashscope.aliyuncs.com",
    aliyunWanModel: process.env.ALIYUN_WAN_MODEL ?? "wan2.6-t2i",
    activeProvider,
    usingMock,
    hint,
  };
}
