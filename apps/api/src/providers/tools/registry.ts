import { AppError } from "../../lib/errors.js";
import { getTool } from "../../lib/tools.js";
import { persistOutputUrls } from "../../lib/persist-output.js";
import { extractReferenceUrlsFromPrompt } from "./extract-references.js";
import { mockToolProvider } from "./mock.js";
import type { ImageToolProvider, ToolRunParams, ToolRunResult } from "./types.js";

const providers: ImageToolProvider[] = [mockToolProvider];

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
  const sampleTool = "cutout";
  const activeProvider = resolveToolProvider(sampleTool).name;

  return {
    mode,
    activeProvider,
    usingMock: activeProvider === "tool-mock",
    hint:
      activeProvider === "tool-mock" ?
        "Studio 工具走 Mock 占位图；配置 TOOL_IMAGE_PROVIDER 与后续 HTTP 供应商可接真能力"
      : "Studio 工具真实供应商",
  };
}
