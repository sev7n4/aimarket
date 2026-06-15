import { concatClipsFfmpeg } from "./ffmpeg-concat.js";
import { synthesizeCosyVoice, isCosyVoiceConfigured } from "./cosyvoice-tts.js";
import {
  lipSyncHeyGen,
  isHeyGenLipSyncConfigured,
} from "./heygen-lipsync.js";
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

const compositeDramaProvider: DramaMediaProvider = {
  name: "drama-composite",
  supportsTts: () => true,
  supportsLipSync: () => true,
  supportsConcat: () => true,

  async synthesizeSpeech(params: TtsParams): Promise<TtsResult> {
    if (isCosyVoiceConfigured()) {
      try {
        return await synthesizeCosyVoice(params);
      } catch (err) {
        console.warn("[drama] CosyVoice failed, fallback mock:", err);
      }
    }
    return mockDramaProvider.synthesizeSpeech(params);
  },

  async lipSync(params: LipSyncParams): Promise<LipSyncResult> {
    if (isHeyGenLipSyncConfigured()) {
      try {
        return await lipSyncHeyGen(params);
      } catch (err) {
        console.warn("[drama] HeyGen lipSync failed, fallback mock:", err);
      }
    }
    return mockDramaProvider.lipSync(params);
  },

  async concatClips(params: ConcatParams): Promise<ConcatResult> {
    try {
      return await concatClipsFfmpeg(params);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg !== "FFMPEG_UNAVAILABLE") {
        console.warn("[drama] FFmpeg concat failed, fallback mock:", err);
      }
      return mockDramaProvider.concatClips(params);
    }
  },
};

export function resolveDramaProvider(): DramaMediaProvider {
  if (process.env.DRAMA_PROVIDER === "mock") {
    return mockDramaProvider;
  }
  return compositeDramaProvider;
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
