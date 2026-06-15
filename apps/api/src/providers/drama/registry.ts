import type {
  ConcatParams,
  ConcatResult,
  DramaMediaProvider,
  LipSyncParams,
  LipSyncResult,
  TtsParams,
  TtsResult,
} from "./types.js";

export const mockDramaProvider: DramaMediaProvider = {
  name: "drama-mock",
  supportsTts: () => true,
  supportsLipSync: () => true,
  supportsConcat: () => true,

  async synthesizeSpeech(params: TtsParams): Promise<TtsResult> {
    const seed = encodeURIComponent(params.text.slice(0, 16));
    return {
      url: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3#tts-${seed}`,
      provider: "drama-mock",
    };
  },

  async lipSync(params: LipSyncParams): Promise<LipSyncResult> {
    return {
      url: params.videoUrl,
      provider: "drama-mock",
    };
  },

  async concatClips(params: ConcatParams): Promise<ConcatResult> {
    const first = params.clipUrls[0] ?? "";
    return {
      url: first.includes("#") ? first : `${first}#drama-final`,
      provider: "drama-mock",
    };
  },
};

export function resolveDramaProvider(): DramaMediaProvider {
  return mockDramaProvider;
}

export async function runTts(params: TtsParams): Promise<TtsResult> {
  return resolveDramaProvider().synthesizeSpeech(params);
}

export async function runLipSync(params: LipSyncParams): Promise<LipSyncResult> {
  return resolveDramaProvider().lipSync(params);
}

export async function runConcat(params: ConcatParams): Promise<ConcatResult> {
  return resolveDramaProvider().concatClips(params);
}
