import { getModel } from "../lib/models.js";
import { persistOutputUrls } from "../lib/persist-output.js";
import { AppError } from "../lib/errors.js";
import { isRetriableI2iProviderError } from "../lib/image-provider-fallback.js";
import {
  aliyunWanI2iConfigured,
  listGenerateProviderCandidates,
  pickGenerateProvider,
  resolveImageProvider,
  type ImageRouteContext,
} from "../lib/image-routing.js";
import type {
  GenerateParams,
  GenerateResult,
  ImageProvider,
  EditParams,
  VariationParams,
  ImageOperation,
} from "./types.js";

export function resolveProvider(
  modelId: string,
  operation: ImageOperation = "generate",
  context: ImageRouteContext = {},
): ImageProvider {
  return resolveImageProvider(modelId, operation, context);
}

async function runGenerateWithProvider(
  provider: ImageProvider,
  params: GenerateParams,
): Promise<GenerateResult & { modelName?: string }> {
  const result = await provider.generate(params);
  const urls = await persistOutputUrls(result.urls);
  const meta = getModel(params.modelId);
  return { ...result, urls, modelName: meta?.name };
}

export async function generateImages(
  params: GenerateParams,
): Promise<GenerateResult & { modelName?: string }> {
  const hasRefs = Boolean(params.referenceUrls?.length);
  const context: ImageRouteContext = {
    hasReferenceImages: hasRefs,
    userId: params.userId,
  };
  const candidates = hasRefs
    ? listGenerateProviderCandidates(params.modelId, true, context)
    : [pickGenerateProvider(params.modelId, false, context)];

  let lastError: unknown;
  for (let i = 0; i < candidates.length; i++) {
    const provider = candidates[i]!;
    try {
      return await runGenerateWithProvider(provider, params);
    } catch (err) {
      lastError = err;
      const hasMore = i < candidates.length - 1;
      if (!hasRefs || !hasMore || !isRetriableI2iProviderError(err)) {
        throw err;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("图生图失败");
}

export async function editImage(
  params: EditParams,
): Promise<GenerateResult & { modelName?: string }> {
  const provider = resolveProvider(params.modelId, "edit", {
    userId: params.userId,
  });
  if (!provider.edit) {
    throw new AppError(
      400,
      "OPERATION_UNSUPPORTED",
      `当前 provider ${provider.name} 不支持图片编辑操作`,
    );
  }
  const result = await provider.edit(params);
  const urls = await persistOutputUrls(result.urls);
  const meta = getModel(params.modelId);
  return { ...result, urls, modelName: meta?.name };
}

export async function variationImage(
  params: VariationParams,
): Promise<GenerateResult & { modelName?: string }> {
  const provider = resolveProvider(params.modelId, "variation", {
    userId: params.userId,
  });
  if (!provider.variation) {
    throw new AppError(
      400,
      "OPERATION_UNSUPPORTED",
      `当前 provider ${provider.name} 不支持图片变体操作`,
    );
  }
  const result = await provider.variation(params);
  const urls = await persistOutputUrls(result.urls);
  const meta = getModel(params.modelId);
  return { ...result, urls, modelName: meta?.name };
}

export function getProviderStatus() {
  const mode = process.env.IMAGE_PROVIDER ?? "auto";
  const openaiConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());
  const aliyunWanConfigured = Boolean(process.env.DASHSCOPE_API_KEY?.trim());
  const seedreamConfigured = Boolean(process.env.ARK_API_KEY?.trim());
  const activeProvider = resolveProvider("omni-v2", "generate").name;
  const usingMock = activeProvider === "mock";

  let hint: string;
  if (mode === "openai" && !openaiConfigured) {
    hint = "已强制 openai 模式但未配置 OPENAI_API_KEY，生成将失败";
  } else if (mode === "aliyun_wan" && !aliyunWanConfigured) {
    hint = "已强制 aliyun_wan 模式但未配置 DASHSCOPE_API_KEY，生成将失败";
  } else if (usingMock && (openaiConfigured || aliyunWanConfigured || seedreamConfigured)) {
    hint =
      "已配置 Key，但当前模型回落 Mock；可设置 IMAGE_PROVIDER=openai/aliyun_wan/seedream";
  } else if (usingMock) {
    hint =
      "演示模式：使用 Mock 占位图，配置 ARK_API_KEY、DASHSCOPE_API_KEY 或 OPENAI_API_KEY 可启用真实出图";
  } else if (activeProvider === "seedream-image") {
    hint = `真实出图：火山方舟 Seedream ${process.env.SEEDREAM_MODEL ?? "doubao-seedream-5-0-260128"}（支持图生图）`;
  } else if (activeProvider === "aliyun-wan") {
    hint = aliyunWanI2iConfigured()
      ? `真实出图：阿里百炼 ${process.env.ALIYUN_WAN_MODEL ?? "wan2.6-t2i"}（文生图）+ ${process.env.ALIYUN_WAN_I2I_MODEL}（图生图）`
      : `真实出图：阿里百炼 ${process.env.ALIYUN_WAN_MODEL ?? "wan2.6-t2i"}（文生图；图生图请配置 ALIYUN_WAN_I2I_MODEL 或 ARK_API_KEY）`;
  } else {
    hint = "真实出图：OpenAI Images API（不支持图生图）";
  }

  return {
    mode,
    openaiConfigured,
    openaiBaseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    openaiImageModel: process.env.OPENAI_IMAGE_MODEL ?? "(按模型自动)",
    aliyunWanConfigured,
    aliyunWanI2iConfigured: aliyunWanI2iConfigured(),
    aliyunWanBaseUrl:
      process.env.DASHSCOPE_BASE_URL ?? "https://dashscope.aliyuncs.com",
    aliyunWanModel: process.env.ALIYUN_WAN_MODEL ?? "wan2.6-t2i",
    seedreamConfigured,
    seedreamBaseUrl:
      process.env.ARK_BASE_URL ?? "https://ark.cn-beijing.volces.com/api/v3",
    seedreamModel: process.env.SEEDREAM_MODEL ?? "doubao-seedream-5-0-260128",
    activeProvider,
    usingMock,
    hint,
  };
}
