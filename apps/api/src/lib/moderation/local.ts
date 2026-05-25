import type { ModerationProvider, ModerationResult } from "./types.js";

const BLOCKED_PATTERNS: RegExp[] = [
  /色情|裸体|nude|porn/i,
  /暴力血腥|杀人|恐怖袭击/i,
  /赌博|博彩|六合彩/i,
  /伪造证件|假身份证|护照造假/i,
  /深度伪造.*名人|换脸.*明星/i,
];

export const localModerationProvider: ModerationProvider = {
  name: "local",
  async check(text: string): Promise<ModerationResult> {
    const trimmed = text.trim();
    if (!trimmed) return { allowed: true, provider: "local" };
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(trimmed)) {
        return { allowed: false, provider: "local" };
      }
    }
    return { allowed: true, provider: "local" };
  },
};
