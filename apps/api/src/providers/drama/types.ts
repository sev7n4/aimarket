export interface TtsParams {
  text: string;
  voiceStyle?: string;
  characterId?: string;
  jobId?: string;
}

export interface TtsResult {
  url: string;
  provider: string;
}

export interface LipSyncParams {
  videoUrl: string;
  audioUrl: string;
  jobId?: string;
}

export interface LipSyncResult {
  url: string;
  provider: string;
}

export interface ConcatParams {
  clipUrls: string[];
  subtitles?: Array<{ startSec: number; endSec: number; text: string }>;
  jobId?: string;
}

export interface ConcatResult {
  url: string;
  provider: string;
}

export interface DramaMediaProvider {
  name: string;
  supportsTts(): boolean;
  supportsLipSync(): boolean;
  supportsConcat(): boolean;
  synthesizeSpeech(params: TtsParams): Promise<TtsResult>;
  lipSync(params: LipSyncParams): Promise<LipSyncResult>;
  concatClips(params: ConcatParams): Promise<ConcatResult>;
}
