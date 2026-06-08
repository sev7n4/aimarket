import { AppError } from "./errors.js";
import { getTool } from "./tools.js";
import { resolveToolProvider } from "../providers/tools/registry.js";
import {
  getCachedProviderHealth,
  type ProviderHealthStatus,
} from "./provider-health-cache.js";
import { applyProbeResult, probeToolProvider } from "./tool-provider-probe.js";

function isMockProviderName(name: string): boolean {
  return name.endsWith("-mock") || name === "tool-mock";
}

/** CI / 本地 mock 出图时允许工具走 mock，不做生产级 preflight 拦截 */
function allowsToolMock(): boolean {
  const toolMode = (process.env.TOOL_IMAGE_PROVIDER ?? "auto").toLowerCase();
  if (toolMode === "mock") return true;
  const imageMode = (process.env.IMAGE_PROVIDER ?? "auto").toLowerCase();
  return imageMode === "mock";
}

function healthErrorMessage(
  toolName: string,
  providerName: string,
  status: ProviderHealthStatus,
  detail?: string,
): string {
  const hint = detail?.trim();
  switch (status) {
    case "auth_error":
      return `${toolName} 暂不可用：上游 API 鉴权失败或未配置（${providerName}）。${hint ? ` ${hint}` : ""}`.trim();
    case "quota_error":
      return `${toolName} 暂不可用：上游推理配额已满或服务已暂停（${providerName}）。${hint ? ` ${hint}` : ""}`.trim();
    case "unavailable":
      return `${toolName} 暂不可用：上游服务暂时不可用（${providerName}）。${hint ? ` ${hint}` : ""}`.trim();
    default:
      return `${toolName} 暂不可用（${providerName}）。`;
  }
}

function throwIfUnhealthy(
  toolName: string,
  providerName: string,
  status: ProviderHealthStatus,
  message?: string,
): void {
  if (status === "ok") return;
  const code =
    status === "auth_error"
      ? "TOOL_PROVIDER_AUTH_ERROR"
      : status === "quota_error"
        ? "TOOL_PROVIDER_QUOTA_EXCEEDED"
        : "TOOL_PROVIDER_UNAVAILABLE";
  throw new AppError(
    503,
    code,
    healthErrorMessage(toolName, providerName, status, message),
  );
}

function resolveConfiguredProvider(
  toolId: string,
  userId?: string,
): { toolName: string; providerName: string } {
  const tool = getTool(toolId);
  if (!tool) {
    throw new AppError(404, "NOT_FOUND", "工具不存在");
  }

  if (allowsToolMock()) {
    return {
      toolName: tool.name,
      providerName: resolveToolProvider(toolId, userId).name,
    };
  }

  const provider = resolveToolProvider(toolId, userId);
  if (isMockProviderName(provider.name)) {
    throw new AppError(
      503,
      "TOOL_PROVIDER_NOT_CONFIGURED",
      `${tool.name} 暂不可用：未配置对应上游 API。请在服务器配置 DASHSCOPE_API_KEY（万相扩图）、ARK_API_KEY（Seedream 工具）或专用 HTTP 网关，详见 PRODUCTION_SECRETS.md。`,
    );
  }

  return { toolName: tool.name, providerName: provider.name };
}

/**
 * 同步：配置级 + 探活缓存（负缓存命中时立即失败，不入队）。
 */
export function assertToolProviderReady(
  toolId: string,
  userId?: string,
): { providerName: string } {
  const { toolName, providerName } = resolveConfiguredProvider(toolId, userId);
  const cached = getCachedProviderHealth(providerName);
  if (cached && cached.status !== "ok") {
    throwIfUnhealthy(toolName, providerName, cached.status, cached.message);
  }
  return { providerName };
}

/**
 * 异步：在缓存未命中或仅正向缓存过期时探活上游，并写入缓存。
 * 应在工具提交路由中于 createGenerationJob 之前 await。
 */
export async function ensureToolProviderHealthy(
  toolId: string,
  userId?: string,
): Promise<{ providerName: string }> {
  if (allowsToolMock()) {
    return assertToolProviderReady(toolId, userId);
  }

  const { providerName } = assertToolProviderReady(toolId, userId);
  const cached = getCachedProviderHealth(providerName);
  if (cached?.status === "ok") {
    return { providerName };
  }

  const tool = getTool(toolId)!;
  const probe = await probeToolProvider(providerName);
  applyProbeResult(providerName, probe);
  throwIfUnhealthy(tool.name, providerName, probe.status, probe.message);
  return { providerName };
}
