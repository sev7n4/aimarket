import { getModel } from "../lib/models.js";
import { persistOutputUrls } from "../lib/persist-output.js";
import { AppError } from "../lib/errors.js";
import { aliyunWanProvider } from "./aliyun-wan.js";
import { mockProvider } from "./mock.js";
import { openaiProvider } from "./openai.js";
import { seedreamImageProvider } from "./seedream-image.js";
import { seededitProvider } from "./seededit-provider.js";
import type {
  GenerateParams,
  GenerateResult,
  ImageProvider,
  EditParams,
  VariationParams,
  ImageOperation,
} from "./types.js";

const providers = [
  seededitProvider,
  seedreamImageProvider,
  aliyunWanProvider,
  openaiProvider,
  mockProvider,
];
>>>>>>> origin/main

export function resolveProvider(
  modelId: string,
  operation: ImageOperation = "generate",
): ImageProvider {
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
    if (!openaiProvider.supports(modelId, operation)) {
      throw new AppError(
        400,
        "MODEL_UNSUPPORTED",
        `当前模型 ${modelId} 不支持 OpenAI ${operation} 操作`,
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
    if (!aliyunWanProvider.supports(modelId, operation)) {
      throw new AppError(
        400,
        "MODEL_UNSUPPORTED",
        `当前模型 ${modelId} 不支持 阿里百炼 wan ${operation} 操作`,
      );
    }
    return aliyunWanProvider;
  }

  for (const p of providers) {
    if (p.supports(modelId, operation)) return p;
  }
  return mockProvider;
}

export async function generateImages(
  params: GenerateParams,
): Promise<GenerateResult & { modelName?: string }> {
  const provider = resolveProvider(params.modelId, "generate");
  const result = await provider.generate(params);
  const urls = await persistOutputUrls(result.urls);
  const meta = getModel(params.modelId);
  return { ...result, urls, modelName: meta?.name };
}

export async function editImage(
  params: EditParams,
): Promise<GenerateResult & { modelName?: string }> {
  const provider = resolveProvider(params.modelId, "edit");
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
  const provider = resolveProvider(params.modelId, "variation");
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
<<<<<<< HEAD
  const activeProvider = resolveProvider("omni-v2").name;
=======
  const activeProvider = resolveProvider("omni-v2", "generate").name;
>>>>>>> origin/main
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
    hint = `真实出图：阿里百炼 ${process.env.ALIYUN_WAN_MODEL ?? "wan2.6-t2i"}（支持图生图）`;
  } else {
    hint = "真实出图：OpenAI Images API（不支持图生图）";
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
    seedreamConfigured,
    seedreamBaseUrl:
      process.env.ARK_BASE_URL ?? "https://ark.cn-beijing.volces.com/api/v3",
    seedreamModel: process.env.SEEDREAM_MODEL ?? "doubao-seedream-5-0-260128",
    activeProvider,
    usingMock,
    hint,
  };
}
