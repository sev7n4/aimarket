import { cutoutMockProvider } from "./cutout-mock.js";
import {
  invokeHttpTool,
  shouldUseHttp,
  type HttpProviderConfig,
} from "./http-shared.js";
import type { ImageToolProvider, ToolRunParams, ToolRunResult } from "./types.js";

const CONFIG: HttpProviderConfig = {
  urlEnv: "TOOL_CUTOUT_HTTP_URL",
  keyEnv: "TOOL_CUTOUT_HTTP_KEY",
  modeEnv: "TOOL_CUTOUT_PROVIDER",
  timeoutMs: 60_000,
};

export const cutoutHttpProvider: ImageToolProvider = {
  name: "tool-cutout-http",
  supports(toolId: string) {
    return toolId === "cutout" && shouldUseHttp(CONFIG);
  },
  async run(params: ToolRunParams): Promise<ToolRunResult> {
    try {
      const result = await invokeHttpTool({ config: CONFIG, params });
      return {
        urls: result.urls,
        provider: "tool-cutout-http",
        mimeType: result.mimeType ?? "image/png",
        width: result.width,
        height: result.height,
      };
    } catch (err) {
      const mode = (process.env[CONFIG.modeEnv] ?? "auto").toLowerCase();
      console.warn("[tool-cutout-http] 调用失败", err);
      if (mode === "http") {
        throw err;
      }
      return cutoutMockProvider.run(params);
    }
  },
};
