import { resolveImageDimensions } from "../../lib/image-size.js";
import { saveGeneratedImage } from "../../lib/storage.js";
import type { ImageToolProvider, ToolRunParams, ToolRunResult } from "./types.js";

const EDIT_TOOL_IDS = new Set(["expand", "inpaint", "erase"]);

/** 最小 JPEG 占位（mock 扩图 / 局部重绘） */
const PLACEHOLDER_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBEQCEAwEPwAB//9k=",
  "base64",
);

function dimensionsForEdit(params: ToolRunParams): [number, number] {
  if (params.toolId === "expand") {
    return resolveImageDimensions(params.resolution, "21:9");
  }
  return resolveImageDimensions(
    params.resolution,
    params.aspectRatio ?? "1:1",
  );
}

export const editMockProvider: ImageToolProvider = {
  name: "tool-edit-mock",
  supports(toolId: string) {
    return EDIT_TOOL_IDS.has(toolId);
  },
  async run(params: ToolRunParams): Promise<ToolRunResult> {
    const [width, height] = dimensionsForEdit(params);
    const saved = await saveGeneratedImage(PLACEHOLDER_JPEG, "image/jpeg");

    return {
      urls: [saved.url],
      provider: "tool-edit-mock",
      mimeType: "image/jpeg",
      width,
      height,
      variant: params.toolId,
    };
  },
};
