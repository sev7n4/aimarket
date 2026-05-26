import { AppError } from "../../lib/errors.js";
import { getTool } from "../../lib/tools.js";
import { persistOutputUrls } from "../../lib/persist-output.js";
import { extractReferenceUrlsFromPrompt } from "./extract-references.js";
import { cutoutMockProvider } from "./cutout-mock.js";
import { mockToolProvider } from "./mock.js";
import { upscaleMockProvider } from "./upscale-mock.js";
import type { ImageToolProvider, ToolRunParams, ToolRunResult } from "./types.js";

const providers: ImageToolProvider[] = [
  cutoutMockProvider,
  upscaleMockProvider,
  mockToolProvider,
];

export function resolveToolProvider(toolId: string): ImageToolProvider {
  const mode = process.env.TOOL_IMAGE_PROVIDER ?? "auto";

  if (mode === "mock") {
    return mockToolProvider;
  }

  if (!getTool(toolId)) {
    throw new AppError(404, "NOT_FOUND", "工具不存在");
  }

  for (const p of providers) {
    if (p.supports(toolId)) return p;
  }

  return mockToolProvider;
}

export async function runToolImages(
  params: Omit<ToolRunParams, "referenceUrls"> & {
    referenceUrls?: string[];
  },
): Promise<ToolRunResult> {
  const referenceUrls =
    params.referenceUrls?.length ?
      params.referenceUrls
    : extractReferenceUrlsFromPrompt(params.prompt);

  const provider = resolveToolProvider(params.toolId);
  const result = await provider.run({
    ...params,
    referenceUrls,
    count: params.count ?? 1,
  });
  const urls = await persistOutputUrls(result.urls);
  return { ...result, urls };
}

export function getToolProviderStatus() {
  const mode = process.env.TOOL_IMAGE_PROVIDER ?? "auto";
  const cutoutProvider = resolveToolProvider("cutout").name;
  const upscaleProvider = resolveToolProvider("upscale").name;
  const enhanceProvider = resolveToolProvider("enhance").name;
  const genericToolProvider = resolveToolProvider("expand").name;

  return {
    mode,
    activeProvider: cutoutProvider,
    cutoutProvider,
    upscaleProvider,
    enhanceProvider,
    genericToolProvider,
    usingMock:
      cutoutProvider.endsWith("-mock") &&
      upscaleProvider.endsWith("-mock") &&
      genericToolProvider.endsWith("-mock"),
    hint:
      cutoutProvider.endsWith("-mock") ?
        "抠图/超分/增强走专用 mock；其余 Studio 工具走通用 mock；后续可接 HTTP 真供应商"
      : "Studio 工具真实供应商",
  };
}
