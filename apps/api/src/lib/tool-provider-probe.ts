import {
  classifyProviderError,
  setCachedProviderHealth,
  type ProviderHealthStatus,
} from "./provider-health-cache.js";
import { dashScopeBaseUrl } from "./dashscope-async.js";

export interface ProbeResult {
  status: ProviderHealthStatus;
  message?: string;
  httpStatus?: number;
}

async function probeHttp(
  url: string,
  init: RequestInit,
  label: string,
): Promise<ProbeResult> {
  try {
    const res = await fetch(url, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(8_000),
    });
    const errText = await res.text().catch(() => "");
    if (res.ok) {
      return { status: "ok" };
    }
    const classified = classifyProviderError(errText, res.status);
    return {
      status: classified ?? "unavailable",
      message: `${label} (${res.status}): ${errText.slice(0, 200)}`,
      httpStatus: res.status,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: "unavailable",
      message: `${label} 探活失败: ${message.slice(0, 200)}`,
    };
  }
}

async function probeSeedream(): Promise<ProbeResult> {
  const apiKey = process.env.ARK_API_KEY?.trim();
  if (!apiKey) {
    return { status: "auth_error", message: "ARK_API_KEY 未配置" };
  }
  const base = (
    process.env.ARK_BASE_URL ?? "https://ark.cn-beijing.volces.com/api/v3"
  ).replace(/\/$/, "");
  return probeHttp(
    `${base}/models`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
    "火山方舟 Seedream",
  );
}

async function probeDashScope(): Promise<ProbeResult> {
  const apiKey = process.env.DASHSCOPE_API_KEY?.trim();
  if (!apiKey) {
    return { status: "auth_error", message: "DASHSCOPE_API_KEY 未配置" };
  }
  const base = dashScopeBaseUrl();
  return probeHttp(
    `${base}/compatible-mode/v1/models`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
    "阿里百炼 DashScope",
  );
}

async function probeHttpTool(
  urlEnv: string,
  label: string,
): Promise<ProbeResult> {
  const url = process.env[urlEnv]?.trim();
  if (!url) {
    return { status: "auth_error", message: `${urlEnv} 未配置` };
  }
  return probeHttp(url, { method: "GET" }, label);
}

/** 对 Studio 工具 Provider 做轻量探活（不创建生成任务、不扣配额） */
export async function probeToolProvider(
  providerName: string,
): Promise<ProbeResult> {
  switch (providerName) {
    case "tool-seedream":
      return probeSeedream();
    case "tool-wan-expand":
      return probeDashScope();
    case "tool-cutout-http":
      return probeHttpTool("TOOL_CUTOUT_HTTP_URL", "抠图 HTTP 网关");
    case "tool-expand-http":
      return probeHttpTool("TOOL_EXPAND_HTTP_URL", "扩图 HTTP 网关");
    case "tool-upscale-http":
      return probeHttpTool("TOOL_UPSCALE_HTTP_URL", "超分 HTTP 网关");
    case "tool-edit-http":
      return probeHttpTool("TOOL_EDIT_HTTP_URL", "编辑 HTTP 网关");
    default:
      return { status: "ok" };
  }
}

export function applyProbeResult(
  providerName: string,
  result: ProbeResult,
): void {
  setCachedProviderHealth(providerName, result.status, result.message);
}
