import type { VideoReferenceMode } from "../../lib/video-references.js";

export interface VideoGenerateParams {
  prompt: string;
  modelId: string;
  count: number;
  resolution: string;
  referenceUrls?: string[];
  referenceMode?: VideoReferenceMode;
  durationSec?: number;
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
