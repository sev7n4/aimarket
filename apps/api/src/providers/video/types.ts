import type {
  SmartMultiShot,
  VideoMediaRef,
  VideoReferenceMode,
  VideoResolution,
} from "../../lib/video-references.js";

export interface VideoGenerateParams {
  prompt: string;
  modelId: string;
  count: number;
  resolution: string;
  aspectRatio?: string;
  videoResolution?: VideoResolution;
  referenceUrls?: string[];
  videoReferences?: Array<VideoMediaRef & { url?: string }>;
  smartMultiShots?: Array<SmartMultiShot & { url?: string }>;
  referenceMode?: VideoReferenceMode;
  durationSec?: number;
}

export interface VideoGenerateResult {
  urls: string[];
  provider: string;
  /** best-effort 降级说明 */
  degradationNote?: string;
}

export interface VideoProvider {
  name: string;
  supports(modelId: string): boolean;
  generate(params: VideoGenerateParams): Promise<VideoGenerateResult>;
}
