/** 将 API job.error 转为用户可读的失败说明 */
export function formatJobErrorMessage(
  error: string | null | undefined,
): string | null {
  if (!error?.trim()) return null;
  const text = error.trim();

  if (
    text.includes("429") ||
    text.includes("SetLimitExceeded") ||
    text.includes("推理上限") ||
    text.includes("Safe Experience Mode")
  ) {
    return "生成失败：火山方舟 Seedream 配额已满或服务已暂停。系统已尝试其他 Provider 兜底；若仍失败请稍后重试或联系管理员。";
  }

  if (
    text.includes("Agnes Image") &&
    (text.includes("500") ||
      text.includes("502") ||
      text.includes("503") ||
      text.includes("upstream_error") ||
      text.includes("InternalServerError"))
  ) {
    return "生成失败：Agnes 图像服务暂时不可用。系统已尝试万相、Seedream 兜底；若仍失败请稍后重试。";
  }

  if (text.includes("ALIYUN_WAN_I2I_MODEL 未配置")) {
    return "图生图失败：未配置万相图生图模型（ALIYUN_WAN_I2I_MODEL），且 Seedream 不可用。";
  }

  if (text.includes("当前无可用图生图 Provider")) {
    return "图生图失败：未配置可用的图生图 API（需 ARK_API_KEY 或 ALIYUN_WAN_I2I_MODEL）。";
  }

  const seedream = text.match(/火山方舟 Seedream 失败[^:]*:\s*(.{0,120})/);
  if (seedream?.[1]) {
    return `生成失败：${seedream[1].replace(/\s+/g, " ").trim()}`;
  }

  const agnes = text.match(/Agnes Image 失败[^:]*:\s*(.{0,120})/);
  if (agnes?.[1]) {
    return `生成失败：${agnes[1].replace(/\s+/g, " ").trim()}`;
  }

  const wan = text.match(/阿里百炼 wan[^:]*:\s*(.{0,120})/);
  if (wan?.[1]) {
    return `生成失败：${wan[1].replace(/\s+/g, " ").trim()}`;
  }

  const firstLine = text.split("\n")[0]?.trim() ?? text;
  return firstLine.length > 160 ? `${firstLine.slice(0, 157)}…` : firstLine;
}
