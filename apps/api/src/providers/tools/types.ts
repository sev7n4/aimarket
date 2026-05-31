export interface ToolRunParams {
  toolId: string;
  prompt: string;
  modelId: string;
  resolution: string;
  aspectRatio?: string;
  referenceUrls: string[];
  /** 任务所属用户，用于 BYOK OpenAI 变体等 */
  userId?: string;
  count?: number;
  toolContext?: {
    toolId: string;
    masks: Array<{
      itemId: string;
      mode: "brush" | "box";
      maskDataUrl: string;
      bbox: { x: number; y: number; width: number; height: number };
      normalizedBbox: { x: number; y: number; width: number; height: number };
    }>;
  };
}

export interface ToolRunResult {
  urls: string[];
  provider: string;
  /** cutout 等工具交付格式（mock/真供应商） */
  mimeType?: string;
  /** upscale mock：2x / 4x / 1x（enhance） */
  scale?: string;
  width?: number;
  height?: number;
  /** expand | inpaint */
  variant?: string;
}

export interface ImageToolProvider {
  name: string;
  supports(toolId: string, userId?: string): boolean;
  run(params: ToolRunParams): Promise<ToolRunResult>;
}
