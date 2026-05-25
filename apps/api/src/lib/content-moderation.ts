import { AppError } from "./errors.js";
import { checkPromptModeration } from "./moderation/index.js";
export { assertOutputsAllowed } from "./moderation/output.js";

/** 生成前内容审核（Phase 6A：外部 API + 本地兜底） */
export async function assertPromptAllowed(prompt: string) {
  const text = prompt.trim();
  if (!text) return;

  const result = await checkPromptModeration(text);
  if (!result.allowed) {
    throw new AppError(
      400,
      "CONTENT_BLOCKED",
      "描述包含违规内容，请修改后重试",
    );
  }
}
