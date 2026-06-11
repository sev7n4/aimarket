/** 解析万相/DashScope 视频 API 错误体为用户可读文案 */
export function parseWanVideoErrorBody(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    const j = JSON.parse(trimmed) as {
      code?: string;
      message?: string;
      error?: { code?: string; message?: string };
    };
    const code = j.code ?? j.error?.code ?? "";
    const message = j.message ?? j.error?.message ?? "";
    return formatWanVideoErrorCode(code, message);
  } catch {
    // fall through
  }

  if (/Arrearage|欠费|余额不足/i.test(trimmed)) {
    return WAN_ARREARAGE_MESSAGE;
  }
  return null;
}

export const WAN_ARREARAGE_MESSAGE =
  "万相视频账号欠费（DashScope Arrearage），请前往阿里云充值后重试";

export function formatWanVideoErrorCode(
  code: string,
  message: string,
): string | null {
  const combined = `${code} ${message}`;
  if (
    code === "Arrearage" ||
    /arrearage|欠费|余额不足|insufficient.*balance/i.test(combined)
  ) {
    return WAN_ARREARAGE_MESSAGE;
  }
  if (
    code === "InvalidApiKey" ||
    /invalidapikey|invalid api.?key/i.test(combined)
  ) {
    return "万相视频鉴权失败，请检查 DASHSCOPE_API_KEY 配置";
  }
  if (code === "Throttling" || /throttl|限流|rate limit/i.test(combined)) {
    return "万相视频请求过于频繁，请稍后重试";
  }
  if (message.trim()) {
    return `万相视频：${message.trim()}`;
  }
  return null;
}

export function formatAgnesVideoTimeoutMessage(input: {
  taskId: string;
  lastStatus: string;
  lastProgress: number | null;
  timeoutMs: number;
  polls: number;
}): string {
  const minutes = Math.round(input.timeoutMs / 60_000);
  const progress =
    input.lastProgress != null ? `，进度 ${input.lastProgress}%` : "";
  return (
    `Agnes Video 排队超时：任务 ${input.taskId} 在 ${minutes} 分钟内仍为 ` +
    `${input.lastStatus}${progress}（轮询 ${input.polls} 次）。` +
    `上游队列繁忙，请稍后重试或改用万相模型。`
  );
}
