/**
 * AI 音乐生成 Provider（骨架实现）
 *
 * 预留 Suno/Udio API 接入点，当前返回 placeholder URL
 */

/** 音乐生成参数 */
export interface MusicGenParams {
  /** 风格描述，如 "轻快电子乐"、"忧伤钢琴" */
  style: string;
  /** 节拍速度（BPM） */
  bpm: number;
  /** 时长（秒） */
  durationSec: number;
}

/** 音乐生成结果 */
export interface MusicGenResult {
  /** 生成音频的公开 URL */
  audioUrl: string;
  /** 实际时长（秒） */
  durationSec: number;
}

/**
 * 生成音乐 — 骨架实现
 *
 * TODO: 接入 Suno/Udio API
 * - Suno API: POST https://api.suno.ai/v1/generate
 * - Udio API: POST https://api.udio.com/v1/generate
 * 当前返回 placeholder URL 和模拟时长
 */
export async function generateMusic(params: MusicGenParams): Promise<MusicGenResult> {
  console.log(
    `[music-gen] 收到请求：style="${params.style}" bpm=${params.bpm} durationSec=${params.durationSec}`,
  );

  // TODO: 接入 Suno/Udio API
  // 当前为骨架实现，返回 placeholder URL
  const placeholderUrl = `https://placeholder.aimarket.local/music/${encodeURIComponent(params.style)}-${params.bpm}bpm-${params.durationSec}s.mp3`;

  return {
    audioUrl: placeholderUrl,
    durationSec: params.durationSec,
  };
}
