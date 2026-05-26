export interface ToolRunParams {
  toolId: string;
  prompt: string;
  modelId: string;
  resolution: string;
  aspectRatio?: string;
  referenceUrls: string[];
  count?: number;
}

export interface ToolRunResult {
  urls: string[];
  provider: string;
}

export interface ImageToolProvider {
  name: string;
  supports(toolId: string): boolean;
  run(params: ToolRunParams): Promise<ToolRunResult>;
}
