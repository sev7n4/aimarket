import { resolveImageDimensions } from "../../lib/image-size.js";
import { upscaleMockProvider } from "./upscale-mock.js";
import {
  invokeHttpTool,
  shouldUseHttp,
  type HttpProviderConfig,
} from "./http-shared.js";
import type { ImageToolProvider, ToolRunParams, ToolRunResult } from "./types.js";

const CONFIG: HttpProviderConfig = {
  urlEnv: "TOOL_UPSCALE_HTTP_URL",
  keyEnv: "TOOL_UPSCALE_HTTP_KEY",
  modeEnv: "TOOL_UPSCALE_PROVIDER",
  timeoutMs: 120_000,
};

const ENHANCE_TOOL_IDS = new Set(["upscale", "enhance"]);

function parseUpscaleFactor(prompt: string): 2 | 4 {
  if (/4\s*[xX倍]/.test(prompt)) return 4;
  return 2;
}

function resolveScale(params: ToolRunParams): { factor: 1 | 2 | 4; tag: string } {
  if (params.toolId === "enhance") return { factor: 1, tag: "1x" };
  const f = parseUpscaleFactor(params.prompt);
  return { factor: f, tag: `${f}x` };
}

export const upscaleHttpProvider: ImageToolProvider = {
  name: "tool-upscale-http",
  supports(toolId: string) {
    return ENHANCE_TOOL_IDS.has(toolId) && shouldUseHttp(CONFIG);
  },
  async run(params: ToolRunParams): Promise<ToolRunResult> {
    const { factor, tag } = resolveScale(params);
    const [baseW, baseH] = resolveImageDimensions(
      params.resolution,
      params.aspectRatio ?? "1:1",
    );

    try {
      const result = await invokeHttpTool({
        config: CONFIG,
        params,
        extra: {
          scale: tag,
          factor,
          targetWidth: Math.min(baseW * factor, 4096),
          targetHeight: Math.min(baseH * factor, 4096),
        },
      });
      return {
        urls: result.urls,
        provider: "tool-upscale-http",
        mimeType: result.mimeType ?? "image/jpeg",
        scale: tag,
        width: result.width ?? Math.min(baseW * factor, 4096),
        height: result.height ?? Math.min(baseH * factor, 4096),
      };
    } catch (err) {
      const mode = (process.env[CONFIG.modeEnv] ?? "auto").toLowerCase();
      console.warn("[tool-upscale-http] 调用失败", err);
      if (mode === "http") {
        throw err;
      }
      return upscaleMockProvider.run(params);
    }
  },
};
