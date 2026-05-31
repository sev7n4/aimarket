import { AppError } from "../../lib/errors.js";
import { getTool } from "../../lib/tools.js";
import { persistOutputUrls } from "../../lib/persist-output.js";
import { toPublicAssetUrls } from "../../lib/public-url.js";
import { extractReferenceUrlsFromPrompt } from "./extract-references.js";
import { cutoutHttpProvider } from "./cutout-http.js";
import { cutoutMockProvider } from "./cutout-mock.js";
import { editHttpProvider } from "./edit-http.js";
import { editMockProvider } from "./edit-mock.js";
import { variationMockProvider } from "./variation-mock.js";
import { variationOpenaiToolProvider } from "./variation-openai-tool.js";
import { mockToolProvider } from "./mock.js";
import { seedreamToolProvider } from "./seedream-tool.js";
import { upscaleHttpProvider } from "./upscale-http.js";
import { upscaleMockProvider } from "./upscale-mock.js";
import type { ImageToolProvider, ToolRunParams, ToolRunResult } from "./types.js";

/** auto 优先级：OpenAI 变体 → Seedream → http → mock */
const providers: ImageToolProvider[] = [
  variationOpenaiToolProvider,
  seedreamToolProvider,
  cutoutHttpProvider,
  cutoutMockProvider,
  upscaleHttpProvider,
  upscaleMockProvider,
  editHttpProvider,
  editMockProvider,
  variationMockProvider,
  mockToolProvider,
];

/** focus-edit 生成走 inpaint 类 provider（局部重绘 / Seedream 编辑） */
export function effectiveToolId(toolId: string): string {
  return toolId === "focus-edit" ? "inpaint" : toolId;
}

export function resolveToolProvider(
  toolId: string,
  userId?: string,
): ImageToolProvider {
  const mode = process.env.TOOL_IMAGE_PROVIDER ?? "auto";
  const resolved = effectiveToolId(toolId);

  if (mode === "mock") {
    return mockToolProvider;
  }

  if (!getTool(toolId)) {
    throw new AppError(404, "NOT_FOUND", "工具不存在");
  }

  for (const p of providers) {
    if (p.supports(resolved, userId)) return p;
  }

  return mockToolProvider;
}

export async function runToolImages(
  params: Omit<ToolRunParams, "referenceUrls"> & {
    referenceUrls?: string[];
  },
): Promise<ToolRunResult> {
  const rawRefs =
    params.referenceUrls?.length ?
      params.referenceUrls
    : extractReferenceUrlsFromPrompt(params.prompt);
  const referenceUrls = toPublicAssetUrls(rawRefs);

  const provider = resolveToolProvider(params.toolId, params.userId);
  const resolvedToolId = effectiveToolId(params.toolId);
  const result = await provider.run({
    ...params,
    toolId: resolvedToolId,
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
  const focusEditProvider = resolveToolProvider("focus-edit").name;
  const variationProvider = resolveToolProvider("variation").name;
  const genericToolProvider = resolveToolProvider("blend").name;

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
    focusEditProvider,
    variationProvider,
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
