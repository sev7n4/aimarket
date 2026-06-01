export interface VlmQualityInput {
  prompt: string;
  urls: string[];
  mode?: string;
}

export interface VlmQualityResult {
  pass: boolean;
  heroIndex: number;
  reason?: string;
  provider: string;
}

export interface VlmProvider {
  name: string;
  supports(): boolean;
  checkQuality(input: VlmQualityInput): Promise<VlmQualityResult>;
}
