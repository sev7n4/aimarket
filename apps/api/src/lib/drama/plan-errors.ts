/** 规划失败时对用户展示的文案（不暴露上游 JSON / 堆栈） */
export function formatDramaPlanError(message: string): string {
  const raw = message.trim();
  if (!raw) return "短剧规划失败，请稍后重试";

  if (/Arrearage|欠费|余额不足|insufficient.*balance/i.test(raw)) {
    return "规划 AI 服务账号欠费或不可用，请稍后重试或联系管理员";
  }
  if (/\[qwen\]|\[deepseek\]|LLM 400|LLM 429|upstream_error/i.test(raw)) {
    return "规划 AI 服务暂时不可用，请稍后重试";
  }
  if (/Agnes Image|阿里百炼|万相|Seedream/i.test(raw)) {
    return "图像生成服务暂时不可用，请稍后重试";
  }

  const withoutJson = raw
    .replace(/\{[\s\S]*\}/g, "")
    .replace(/\[[\w-]+\]\s*/g, "")
    .trim();
  const cleaned = withoutJson || raw;
  if (cleaned.length > 160) {
    return `${cleaned.slice(0, 160)}…`;
  }
  return cleaned;
}
