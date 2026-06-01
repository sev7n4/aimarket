/**
 * Studio 工具 HTTP 真供应商共享辅助
 *
 * 协议（最小约定，便于自建网关 / Replicate 包一层 / 国内云服务接入）：
 *   POST {URL}
 *   Headers: Authorization: Bearer {KEY}, Content-Type: application/json
 *   Body:    { tool, prompt, referenceUrls, count, resolution, aspectRatio, extend?, extendScales?, outpaint?, toolContext?, ... }
 *   Resp:    { urls: string[], mimeType?, width?, height? }
 *
 * 任何 4xx/5xx 或缺失 urls 视为失败；auto 模式下由上层回落到 mock。
 */
import type { ToolRunParams } from "./types.js";

export interface HttpProviderConfig {
  /** 兜底环境变量名，如 TOOL_CUTOUT_HTTP_URL */
  urlEnv: string;
  /** Bearer Key 环境变量名（可选） */
  keyEnv?: string;
  /** 工具组通用模式：TOOL_CUTOUT_PROVIDER 等 */
  modeEnv: string;
  /** 单次请求超时 ms */
  timeoutMs?: number;
}

export type HttpProviderMode = "mock" | "http" | "auto";

export interface HttpProviderResponse {
  urls: string[];
  mimeType?: string;
  width?: number;
  height?: number;
}

export function resolveHttpProviderMode(modeEnv: string): HttpProviderMode {
  const raw = (process.env[modeEnv] ?? "auto").toLowerCase();
  if (raw === "mock" || raw === "http") return raw;
  return "auto";
}

export function isHttpConfigured(config: HttpProviderConfig): boolean {
  return Boolean(process.env[config.urlEnv]?.trim());
}

export function shouldUseHttp(config: HttpProviderConfig): boolean {
  const mode = resolveHttpProviderMode(config.modeEnv);
  if (mode === "mock") return false;
  if (mode === "http") return true;
  return isHttpConfigured(config);
}

export interface InvokeHttpToolParams {
  config: HttpProviderConfig;
  params: ToolRunParams;
  /** 透传给供应商的额外字段 */
  extra?: Record<string, unknown>;
}

export async function invokeHttpTool({
  config,
  params,
  extra,
}: InvokeHttpToolParams): Promise<HttpProviderResponse> {
  const url = process.env[config.urlEnv]?.trim();
  if (!url) {
    throw new Error(`${config.urlEnv} 未配置`);
  }
  const key = config.keyEnv ? process.env[config.keyEnv]?.trim() : undefined;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (key) headers.Authorization = `Bearer ${key}`;

  const extend = params.extend ?? params.toolContext?.extend;
  const body = {
    tool: params.toolId,
    prompt: params.prompt,
    referenceUrls: params.referenceUrls,
    count: params.count ?? 1,
    resolution: params.resolution,
    aspectRatio: params.aspectRatio ?? "1:1",
    toolContext: params.toolContext,
    extend,
    ...extra,
  };

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(config.timeoutMs ?? 60_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `${config.urlEnv} 调用失败 (${res.status}): ${errText.slice(0, 200)}`,
    );
  }

  const json = (await res.json()) as Partial<HttpProviderResponse>;
  const urls = json.urls?.filter((u) => typeof u === "string" && u.length > 0);
  if (!urls || urls.length === 0) {
    throw new Error(`${config.urlEnv} 响应缺少 urls`);
  }

  return {
    urls,
    mimeType: json.mimeType,
    width: json.width,
    height: json.height,
  };
}
