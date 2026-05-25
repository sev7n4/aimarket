import { getModel } from "../lib/models.js";
import { mockProvider } from "./mock.js";
import { openaiProvider } from "./openai.js";
import type { GenerateParams, GenerateResult } from "./types.js";

const providers = [openaiProvider, mockProvider];

export function resolveProvider(modelId: string) {
  const mode = process.env.IMAGE_PROVIDER ?? "auto";
  if (mode === "mock") return mockProvider;
  if (mode === "openai") return openaiProvider;

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
  const meta = getModel(params.modelId);
  return { ...result, modelName: meta?.name };
}

export function getProviderStatus() {
  return {
    mode: process.env.IMAGE_PROVIDER ?? "auto",
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    activeProvider: resolveProvider("omni-v2").name,
  };
}
