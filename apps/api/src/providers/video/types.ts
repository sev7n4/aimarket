export interface VideoGenerateParams {
  prompt: string;
  modelId: string;
  count: number;
  resolution: string;
}

export interface VideoGenerateResult {
  urls: string[];
  provider: string;
}

export interface VideoProvider {
  name: string;
  supports(modelId: string): boolean;
  generate(params: VideoGenerateParams): Promise<VideoGenerateResult>;
}
