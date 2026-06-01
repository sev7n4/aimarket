import { resolveImageDimensions } from "../../lib/image-size.js";
import { editMockProvider } from "./edit-mock.js";
import {
  invokeHttpTool,
  shouldUseHttp,
  type HttpProviderConfig,
} from "./http-shared.js";
import type { ImageToolProvider, ToolRunParams, ToolRunResult } from "./types.js";

const CONFIG: HttpProviderConfig = {
  urlEnv: "TOOL_EDIT_HTTP_URL",
  keyEnv: "TOOL_EDIT_HTTP_KEY",
  modeEnv: "TOOL_EDIT_PROVIDER",
  timeoutMs: 180_000,
};

const EDIT_TOOL_IDS = new Set(["inpaint", "erase"]);

function targetAspect(params: ToolRunParams): string {
  return params.aspectRatio ?? "1:1";
}

export const editHttpProvider: ImageToolProvider = {
  name: "tool-edit-http",
  supports(toolId: string) {
    return EDIT_TOOL_IDS.has(toolId) && shouldUseHttp(CONFIG);
  },
  async run(params: ToolRunParams): Promise<ToolRunResult> {
    const aspect = targetAspect(params);
    const [targetWidth, targetHeight] = resolveImageDimensions(
      params.resolution,
      aspect,
    );

    try {
      const result = await invokeHttpTool({
        config: CONFIG,
        params,
        extra: {
          variant: params.toolId,
          aspectRatio: aspect,
          targetWidth,
          targetHeight,
        },
      });
      return {
        urls: result.urls,
        provider: "tool-edit-http",
        mimeType: result.mimeType ?? "image/jpeg",
        width: result.width ?? targetWidth,
        height: result.height ?? targetHeight,
        variant: params.toolId,
      };
    } catch (err) {
      const mode = (process.env[CONFIG.modeEnv] ?? "auto").toLowerCase();
      console.warn("[tool-edit-http] 调用失败", err);
      if (mode === "http") {
        throw err;
      }
      return editMockProvider.run(params);
    }
  },
};
