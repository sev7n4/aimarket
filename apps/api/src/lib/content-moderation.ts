import { AppError } from "./errors.js";

/** 生成前敏感词拦截（Phase 6 合规基础版，可扩展为外部审核 API） */
const BLOCKED_PATTERNS: RegExp[] = [
  /色情|裸体|nude|porn/i,
  /暴力血腥|杀人|恐怖袭击/i,
  /赌博|博彩|六合彩/i,
  /伪造证件|假身份证|护照造假/i,
  /深度伪造.*名人|换脸.*明星/i,
];

export function assertPromptAllowed(prompt: string) {
  const text = prompt.trim();
  if (!text) return;
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(text)) {
      throw new AppError(
        400,
        "CONTENT_BLOCKED",
        "描述包含违规内容，请修改后重试",
      );
    }
  }
}
