import { AppError } from "../../lib/errors.js";
import { getTool } from "../../lib/tools.js";
import { persistOutputUrls } from "../../lib/persist-output.js";
import { toPublicAssetUrls } from "../../lib/public-url.js";
import { getCachedProviderHealth } from "../../lib/provider-health-cache.js";
import { extractReferenceUrlsFromPrompt } from "./extract-references.js";
import { cutoutHttpProvider } from "./cutout-http.js";
import { cutoutMockProvider } from "./cutout-mock.js";
import { editHttpProvider } from "./edit-http.js";
import { editMockProvider } from "./edit-mock.js";
import { variationMockProvider } from "./variation-mock.js";
import { variationOpenaiToolProvider } from "./variation-openai-tool.js";
import { mockToolProvider } from "./mock.js";
import { expandHttpProvider } from "./expand-http.js";
import { seedreamToolProvider } from "./seedream-tool.js";
import { wanExpandToolProvider } from "./wan-expand-tool.js";
import { upscaleHttpProvider } from "./upscale-http.js";
import { upscaleMockProvider } from "./upscale-mock.js";
import { multiCam9ToolProvider, multiCam25ToolProvider } from "./multi-cam-provider.js";
import { storyboardEvolveProvider } from "./storyboard-evolve-provider.js";
import { videoInpaintProvider } from "./video-inpaint-provider.js";
import { gridSplitToolProvider } from "./grid-split-provider.js";
import { turnaround360Provider } from "./turnaround-360-provider.js";
import { urlScraperProvider } from "./url-scraper-provider.js";
import { musicGenToolProvider } from "./music-gen-tool-provider.js";
import type { ImageToolProvider, ToolRunParams, ToolRunResult } from "./types.js";

/** auto 优先级：扩图 Wan → 扩图 HTTP → OpenAI 变体 → Seedream → 其他 http → mock */
const providers: ImageToolProvider[] = [
  wanExpandToolProvider,
  expandHttpProvider,
  variationOpenaiToolProvider,
  seedreamToolProvider,
  cutoutHttpProvider,
  cutoutMockProvider,
  upscaleHttpProvider,
  upscaleMockProvider,
  editHttpProvider,
  editMockProvider,
  variationMockProvider,
  multiCam9ToolProvider,
  multiCam25ToolProvider,
  storyboardEvolveProvider,
  videoInpaintProvider,
  gridSplitToolProvider,
  turnaround360Provider,
  urlScraperProvider,
  musicGenToolProvider,
  mockToolProvider,
];

/** 语义工具映射上下文：根据 prompt / mask / 焦点推断更精确的工具 ID */
export interface EffectiveToolContext {
  /** 原始工具 ID */
  toolId: string;
  /** 用户 prompt */
  prompt?: string;
  /** 是否有 mask */
  hasMasks?: boolean;
  /** 是否有焦点编辑点 */
  hasFocusPoints?: boolean;
  /** 物体类别（来自 focus-edit 推断） */
  objectCategory?: string;
}

/**
 * 语义工具映射：根据上下文将工具 ID 映射到更精确的内部工具。
 * - focus-edit + objectCategory === "text" → "text"（改字工具）
 * - focus-edit + 有 mask → "inpaint"（局部重绘）
 * - focus-edit + 无 mask → "inpaint"（保持默认）
 * - 其他 toolId → 原样返回
 * 向后兼容：不传 context 时行为与原始实现完全一致。
 */
export function effectiveToolId(toolId: string, context?: EffectiveToolContext): string {
  if (toolId !== "focus-edit") return toolId;
  if (!context) return "inpaint";
  if (context.objectCategory === "text") return "text";
  return "inpaint";
}

/** 返回所有 supports() 为 true 的 Provider（排除 mock） */
export function resolveAllToolProviders(
  toolId: string,
  userId?: string,
  context?: EffectiveToolContext,
): ImageToolProvider[] {
  const resolved = effectiveToolId(toolId, context);
  return providers.filter(
    (p) => p !== mockToolProvider && p.supports(resolved, userId),
  );
}

/**
 * 健康度加权路由：在匹配多个 Provider 时优先选择健康的。
 * 1. 调用 effectiveToolId 解析语义工具
 * 2. 收集所有 supports() 返回 true 的 Provider
 * 3. 过滤掉不健康的（健康缓存标记为非 ok）
 * 4. 所有都不健康时降级返回第一个匹配的（不阻塞）
 * 5. 无匹配时返回 mock
 */
export function resolveToolProvider(
  toolId: string,
  userId?: string,
  context?: EffectiveToolContext,
): ImageToolProvider {
  const mode = process.env.TOOL_IMAGE_PROVIDER ?? "auto";
  const resolved = effectiveToolId(toolId, context);

  if (mode === "mock") {
    return mockToolProvider;
  }

  if (!getTool(toolId)) {
    throw new AppError(404, "NOT_FOUND", "工具不存在");
  }

  /* 收集所有匹配的 Provider */
  const matched: ImageToolProvider[] = [];
  for (const p of providers) {
    if (p.supports(resolved, userId)) matched.push(p);
  }

  if (matched.length === 0) return mockToolProvider;
  if (matched.length === 1) return matched[0];

  /* 从匹配列表中过滤掉不健康的 Provider */
  const healthy = matched.filter((p) => {
    const cached = getCachedProviderHealth(p.name);
    return !cached || cached.status === "ok";
  });

  if (healthy.length > 0) return healthy[0];

  /* 全部不健康，降级返回第一个匹配的（不阻塞用户） */
  return matched[0];
}

/**
 * A/B Fallback：首选 Provider 失败时自动降级到下一个匹配的 Provider。
 * 1. 获取所有匹配的非 mock Provider
 * 2. 依次尝试运行，记录失败日志
 * 3. 全部失败则抛出最后一个错误
 * 4. 成功时记录使用的 Provider 名称
 */
export async function runToolImagesWithFallback(
  params: Omit<ToolRunParams, "referenceUrls"> & {
    referenceUrls?: string[];
  },
): Promise<ToolRunResult> {
  const rawRefs =
    params.referenceUrls?.length ?
      params.referenceUrls
    : extractReferenceUrlsFromPrompt(params.prompt);
  const referenceUrls = toPublicAssetUrls(rawRefs);
  const resolvedToolId = effectiveToolId(params.toolId);
  const extend = params.extend ?? params.toolContext?.extend;
  const runParams = {
    ...params,
    toolId: resolvedToolId,
    referenceUrls,
    count: params.count ?? 1,
    extend,
  };

  /* 获取所有候选 Provider */
  const candidates = resolveAllToolProviders(params.toolId, params.userId);
  let lastError: unknown;

  for (const provider of candidates) {
    try {
      const result = await provider.run(runParams);
      const urls = await persistOutputUrls(result.urls);
      return { ...result, urls };
    } catch (err) {
      lastError = err;
      console.warn(
        `[tool-fallback] Provider "${provider.name}" 执行失败，尝试下一个`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  /* 所有候选都失败，降级到 resolveToolProvider（含 mock）再试一次 */
  const fallbackProvider = resolveToolProvider(params.toolId, params.userId);
  if (!candidates.includes(fallbackProvider)) {
    try {
      const result = await fallbackProvider.run(runParams);
      const urls = await persistOutputUrls(result.urls);
      return { ...result, urls };
    } catch (err) {
      lastError = err;
      console.warn(
        `[tool-fallback] 降级 Provider "${fallbackProvider.name}" 也失败`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  throw lastError;
}

/** 保持原有签名不变，内部委托给 runToolImagesWithFallback */
export async function runToolImages(
  params: Omit<ToolRunParams, "referenceUrls"> & {
    referenceUrls?: string[];
  },
): Promise<ToolRunResult> {
  return runToolImagesWithFallback(params);
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
  const expandMode = (process.env.TOOL_EXPAND_PROVIDER ?? "auto").toLowerCase();
  const expandHttpConfigured = Boolean(
    process.env.TOOL_EXPAND_HTTP_URL?.trim(),
  );
  const wanExpandConfigured = Boolean(process.env.DASHSCOPE_API_KEY?.trim());
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
    expandMode,
    expandHttpConfigured,
    wanExpandConfigured,
    wanExpandModel:
      process.env.ALIYUN_WAN_EXPAND_MODEL?.trim() ?? "wanx2.1-imageedit",
    seedreamConfigured,
    seedreamModel,
    genericToolProvider,
    usingMock: allMock,
    hint: allMock
      ? "Studio 工具按类型走专用 mock；配置 DASHSCOPE_API_KEY（万相扩图）/ TOOL_EXPAND_HTTP_URL / ARK_API_KEY 后切换真供应商"
      : `Studio 工具真实供应商：${cutoutProvider}/${upscaleProvider}/${expandProvider}`,
  };
}
