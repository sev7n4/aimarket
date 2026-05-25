export interface GenerateParams {
  prompt: string;
  modelId: string;
  count: number;
  resolution: string;
  aspectRatio?: string;
  referenceUrls?: string[];
}

export interface GenerateResult {
  urls: string[];
  provider: string;
}

export interface ImageProvider {
  name: string;
  supports(modelId: string): boolean;
  generate(params: GenerateParams): Promise<GenerateResult>;
}
