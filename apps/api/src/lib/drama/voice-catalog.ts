/** CosyVoice 音色目录（规划期角色旁白 / 对白 TTS） */
export interface DramaVoiceOption {
  id: string;
  label: string;
  description: string;
  cosyVoiceId: string;
  sampleText: string;
}

export const DRAMA_VOICE_CATALOG: DramaVoiceOption[] = [
  {
    id: "warm_female",
    label: "温柔坚定",
    description: "女声 · 情感细腻",
    cosyVoiceId: "longxiaoxia",
    sampleText: "雨夜的重逢，让误会终于解开。",
  },
  {
    id: "bright_male",
    label: "爽朗",
    description: "男声 · 明亮自然",
    cosyVoiceId: "longxiaochun",
    sampleText: "这家咖啡店，还是老样子。",
  },
  {
    id: "narrator_calm",
    label: "旁白沉稳",
    description: "旁白 · 纪录片感",
    cosyVoiceId: "longxiaochun",
    sampleText: "三分钟讲完误会与和解。",
  },
  {
    id: "youthful_female",
    label: "青春女声",
    description: "女声 · 轻快",
    cosyVoiceId: "longxiaoxia",
    sampleText: "没想到会在这里再次遇见你。",
  },
];

const byId = new Map(DRAMA_VOICE_CATALOG.map((v) => [v.id, v]));

const STYLE_ALIASES: Record<string, string> = {
  温柔坚定: "warm_female",
  温柔: "warm_female",
  爽朗: "bright_male",
  旁白沉稳: "narrator_calm",
  旁白: "narrator_calm",
  青春女声: "youthful_female",
};

export function inferVoiceIdFromStyle(voiceStyle?: string): string {
  if (!voiceStyle) return "warm_female";
  const trimmed = voiceStyle.trim();
  if (byId.has(trimmed)) return trimmed;
  return STYLE_ALIASES[trimmed] ?? "warm_female";
}

export function resolveCosyVoiceId(input: {
  voiceId?: string;
  voiceStyle?: string;
}): string {
  const fromId = input.voiceId ? byId.get(input.voiceId) : undefined;
  if (fromId) return fromId.cosyVoiceId;
  const inferred = inferVoiceIdFromStyle(input.voiceStyle);
  return byId.get(inferred)?.cosyVoiceId ?? "longxiaochun";
}

export function serializeVoiceCatalog() {
  return DRAMA_VOICE_CATALOG.map(({ id, label, description, sampleText }) => ({
    id,
    label,
    description,
    sampleText,
  }));
}
