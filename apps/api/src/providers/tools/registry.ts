import { AppError } from "../../lib/errors.js";
import { getTool } from "../../lib/tools.js";
import { persistOutputUrls } from "../../lib/persist-output.js";
import { extractReferenceUrlsFromPrompt } from "./extract-references.js";
import { cutoutHttpProvider } from "./cutout-http.js";
import { cutoutMockProvider } from "./cutout-mock.js";
import { editHttpProvider } from "./edit-http.js";
import { editMockProvider } from "./edit-mock.js";
import { mockToolProvider } from "./mock.js";
import { seedreamToolProvider } from "./seedream-tool.js";
import { upscaleHttpProvider } from "./upscale-http.js";
import { upscaleMockProvider } from "./upscale-mock.js";
import type { ImageToolProvider, ToolRunParams, ToolRunResult } from "./types.js";

/** auto 优先级：vendor (seedream) → http → mock */
const providers: ImageToolProvider[] = [
  seedreamToolProvider,
  cutoutHttpProvider,
  cutoutMockProvider,
  upscaleHttpProvider,
  upscaleMockProvider,
  editHttpProvider,
  editMockProvider,
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
  const cutoutMode = (process.env.TOOL_CUTOUT_PROVIDER ?? "auto").toLowerCase();
  const cutoutHttpConfigured = Boolean(
    process.env.TOOL_CUTOUT_HTTP_URL?.trim(),
  );
  const upscaleMode = (
    process.env.TOOL_UPSCALE_PROVIDER ?? "auto"
  ).toLowerCase();
  const upscaleHttpConfigured = Boolean(
    process.env.TOOL_UPSCALE_HTTP_URL?.trim(),
  );
  const editMode = (process.env.TOOL_EDIT_PROVIDER ?? "auto").toLowerCase();
  const editHttpConfigured = Boolean(process.env.TOOL_EDIT_HTTP_URL?.trim());
  const seedreamConfigured = Boolean(process.env.ARK_API_KEY?.trim());
  const seedreamModel =
    process.env.SEEDREAM_MODEL ?? "doubao-seedream-5-0-260128";
  const cutoutProvider = resolveToolProvider("cutout").name;
  const upscaleProvider = resolveToolProvider("upscale").name;
  const enhanceProvider = resolveToolProvider("enhance").name;
  const expandProvider = resolveToolProvider("expand").name;
  const inpaintProvider = resolveToolProvider("inpaint").name;
  const genericToolProvider = resolveToolProvider("erase").name;

  const allMock =
    cutoutProvider.endsWith("-mock") &&
    upscaleProvider.endsWith("-mock") &&
    expandProvider.endsWith("-mock") &&
    genericToolProvider.endsWith("-mock");

  return {
    mode,
    activeProvider: cutoutProvider,
    cutoutProvider,
    cutoutMode,
    cutoutHttpConfigured,
    upscaleProvider,
    upscaleMode,
    upscaleHttpConfigured,
    enhanceProvider,
    expandProvider,
    inpaintProvider,
    editMode,
    editHttpConfigured,
    seedreamConfigured,
    seedreamModel,
    genericToolProvider,
    usingMock: allMock,
    hint: allMock
      ? "Studio 工具按类型走专用 mock；配置 ARK_API_KEY（火山方舟 Seedream）或 TOOL_*_HTTP_URL 后切换真供应商"
      : `Studio 工具真实供应商：${cutoutProvider}/${upscaleProvider}/${expandProvider}`,
  };
}
