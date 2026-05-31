import { resolveImageDimensions } from "../../lib/image-size.js";
import { saveGeneratedImage } from "../../lib/storage.js";
import type { ImageToolProvider, ToolRunParams, ToolRunResult } from "./types.js";

const PLACEHOLDER_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBEQCEAwEPwAB//9k=",
  "base64",
);

export const variationMockProvider: ImageToolProvider = {
  name: "tool-variation-mock",
  supports(toolId: string) {
    return toolId === "variation";
  },
  async run(params: ToolRunParams): Promise<ToolRunResult> {
    const [width, height] = resolveImageDimensions(
      params.resolution,
      params.aspectRatio ?? "1:1",
    );
    const count = params.count ?? 1;
    const urls: string[] = [];
    for (let i = 0; i < count; i++) {
      const saved = await saveGeneratedImage(PLACEHOLDER_JPEG, "image/jpeg");
      urls.push(saved.url);
    }
    return {
      urls,
      provider: "tool-variation-mock",
      mimeType: "image/jpeg",
      width,
      height,
      variant: "variation",
    };
  },
};
