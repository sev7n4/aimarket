/**
 * 扩图专用 HTTP 网关（FLUX Fill / Ideogram Canvas / 自建 outpaint）
 *
 * 环境变量：
 *   TOOL_EXPAND_HTTP_URL  — POST 网关地址
 *   TOOL_EXPAND_HTTP_KEY  — 可选 Bearer
 *   TOOL_EXPAND_PROVIDER  — auto | http | wan | seedream | mock
 *
 * 请求体在 http-shared 约定基础上增加 extend / extendScales / function。
 */
import { resolveExpandScales } from "../../lib/expand-extend.js";
import { editMockProvider } from "./edit-mock.js";
import {
  invokeHttpTool,
  shouldUseHttp,
  type HttpProviderConfig,
} from "./http-shared.js";
import type { ImageToolProvider, ToolRunParams, ToolRunResult } from "./types.js";

const CONFIG: HttpProviderConfig = {
  urlEnv: "TOOL_EXPAND_HTTP_URL",
  keyEnv: "TOOL_EXPAND_HTTP_KEY",
  modeEnv: "TOOL_EXPAND_PROVIDER",
  timeoutMs: 180_000,
};

function pickExtend(params: ToolRunParams) {
  return params.extend ?? params.toolContext?.extend;
}

export const expandHttpProvider: ImageToolProvider = {
  name: "tool-expand-http",
  supports(toolId: string) {
    return toolId === "expand" && shouldUseHttp(CONFIG);
  },
  async run(params: ToolRunParams): Promise<ToolRunResult> {
    const extend = pickExtend(params);
    const extendScales = resolveExpandScales(extend);

    try {
      const result = await invokeHttpTool({
        config: CONFIG,
        params,
        extra: {
          variant: "expand",
          function: "expand",
          extend,
          extendScales,
          /** FLUX Fill 等网关可读的别名 */
          outpaint: extendScales,
        },
      });
      return {
        urls: result.urls,
        provider: "tool-expand-http",
        mimeType: result.mimeType ?? "image/jpeg",
        width: result.width,
        height: result.height,
        variant: "expand",
      };
    } catch (err) {
      const mode = (process.env[CONFIG.modeEnv] ?? "auto").toLowerCase();
      console.warn("[tool-expand-http] 调用失败", err);
      if (mode === "http") {
        throw err;
      }
      return editMockProvider.run(params);
    }
  },
};
