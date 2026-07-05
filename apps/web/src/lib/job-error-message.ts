export interface FormatJobErrorOptions {
  /** Studio 工具任务（扩图/抠图等），无 Auto 多 Provider 回落 */
  toolType?: string | null;
  /** 文生图/图生图是否为 Auto 智能路由 */
  autoRoute?: boolean;
}

const TOOL_LABELS: Record<string, string> = {
  expand: "扩图",
  cutout: "抠图",
  upscale: "超分",
  enhance: "增强",
  erase: "消除",
  inpaint: "局部重绘",
  "focus-edit": "焦点编辑",
  variation: "变体",
};

function toolLabel(toolType?: string | null): string {
  if (!toolType) return "工具";
  return TOOL_LABELS[toolType] ?? toolType;
}

function isToolJob(toolType?: string | null): boolean {
  return Boolean(toolType && toolType !== "video");
}

function mentionsFallback(autoRoute?: boolean, toolType?: string | null): boolean {
  if (isToolJob(toolType)) return false;
  return autoRoute !== false;
}

/** 将 API job.error 转为用户可读的失败说明 */
export function formatJobErrorMessage(
  error: string | null | undefined,
  options: FormatJobErrorOptions = {},
): string | null {
  if (!error?.trim()) return null;
  const text = error.trim();
  const { toolType, autoRoute } = options;
  const withFallback = mentionsFallback(autoRoute, toolType);

  if (text.includes("ALIYUN_WAN_I2I_MODEL 未配置")) {
    return "图生图失败：未配置万相图生图模型（ALIYUN_WAN_I2I_MODEL），且 Seedream 不可用。";
  }

  if (text.includes("当前无可用图生图 Provider")) {
    return "图生图失败：未配置可用的图生图 API（需 ARK_API_KEY 或 ALIYUN_WAN_I2I_MODEL）。";
  }

  if (
    text.includes("401") ||
    text.includes("403") ||
    /unauthorized/i.test(text) ||
    /invalid api.?key/i.test(text) ||
    /API_KEY 未配置/.test(text) ||
    text.includes("鉴权失败")
  ) {
    if (isToolJob(toolType)) {
      return `${toolLabel(toolType)}失败：上游 API 鉴权失败或未配置，请检查服务器密钥后重试。`;
    }
    return "生成失败：上游 API 鉴权失败或未配置，请检查服务器密钥后重试。";
  }

  if (
    text.includes("429") ||
    text.includes("SetLimitExceeded") ||
    text.includes("推理上限") ||
    text.includes("Safe Experience Mode")
  ) {
    if (isToolJob(toolType)) {
      return `${toolLabel(toolType)}失败：火山方舟 Seedream 配额已满或服务已暂停，请稍后重试或联系管理员。`;
    }
    if (withFallback) {
      return "生成失败：火山方舟 Seedream 配额已满或服务已暂停。系统已尝试其他 Provider 兜底；若仍失败请稍后重试或联系管理员。";
    }
    return "生成失败：火山方舟 Seedream 配额已满或服务已暂停，请稍后重试或联系管理员。";
  }

  if (
    text.includes("Agnes Image") &&
    (text.includes("500") ||
      text.includes("502") ||
      text.includes("503") ||
      text.includes("upstream_error") ||
      text.includes("InternalServerError"))
  ) {
    if (isToolJob(toolType)) {
      return `${toolLabel(toolType)}失败：Agnes 图像服务暂时不可用，请稍后重试。`;
    }
    if (withFallback) {
      return "生成失败：Agnes 图像服务暂时不可用。系统已尝试万相、Seedream 兜底；若仍失败请稍后重试。";
    }
    return "生成失败：Agnes 图像服务暂时不可用，请稍后重试。";
  }

  if (
    text.includes("Model not exist") ||
    (text.includes("InvalidParameter") && text.includes("model"))
  ) {
    if (withFallback) {
      return "生成失败：万相图生图模型配置有误，系统已尝试其他 Provider 兜底；若仍失败请联系管理员检查 ALIYUN_WAN_I2I_MODEL（应为 wan2.6-image）。";
    }
    return "生成失败：万相图生图模型不存在，请检查服务器 ALIYUN_WAN_I2I_MODEL 配置（应为 wan2.6-image）。";
  }

  if (
    /Arrearage|DashScope.*欠费|in good standing/i.test(text) ||
    (text.includes("万相") && /欠费|arrearage/i.test(text))
  ) {
    if (toolType === "video" || text.includes("万相视频")) {
      return "视频生成失败：万相（DashScope）账号欠费，请充值后重试。";
    }
    if (withFallback) {
      return "生成失败：万相（DashScope）账号欠费，系统已尝试 Agnes / Seedream 兜底；若仍失败请充值阿里云或联系管理员。";
    }
    return "生成失败：万相（DashScope）账号欠费，请前往阿里云充值后重试。";
  }

  if (/Agnes Video 排队超时|Agnes Video 任务超时/i.test(text)) {
    return "视频生成超时：Agnes 队列繁忙，任务长时间未完成。请稍后重试或切换万相模型。";
  }

  if (text.includes("万相视频任务超时")) {
    return "视频生成超时：万相任务未在时限内完成，请稍后重试。";
  }

  if (text.includes("DashScope") || text.includes("万相")) {
    const wan = text.match(/DashScope[^:]*:\s*(.{0,120})/i);
    const detail = wan?.[1]?.replace(/\s+/g, " ").trim();
    if (toolType === "video" || text.includes("万相视频")) {
      if (/万相视频：/.test(text)) {
        const m = text.match(/万相视频：(.{0,120})/);
        if (m?.[1]) return `视频生成失败：${m[1].trim()}`;
      }
      return detail
        ? `视频生成失败：${detail}`
        : "视频生成失败：万相服务不可用，请稍后重试。";
    }
    if (isToolJob(toolType)) {
      return detail
        ? `${toolLabel(toolType)}失败：${detail}`
        : `${toolLabel(toolType)}失败：万相服务不可用，请稍后重试。`;
    }
  }

  const seedream = text.match(/火山方舟 Seedream 失败[^:]*:\s*(.{0,120})/);
  if (seedream?.[1]) {
    const detail = seedream[1].replace(/\s+/g, " ").trim();
    if (isToolJob(toolType)) {
      return `${toolLabel(toolType)}失败：${detail}`;
    }
    return `生成失败：${detail}`;
  }

  const agnes = text.match(/Agnes Image 失败[^:]*:\s*(.{0,120})/);
  if (agnes?.[1]) {
    const detail = agnes[1].replace(/\s+/g, " ").trim();
    if (isToolJob(toolType)) {
      return `${toolLabel(toolType)}失败：${detail}`;
    }
    return `生成失败：${detail}`;
  }

  const wan = text.match(/阿里百炼 wan[^:]*:\s*(.{0,120})/);
  if (wan?.[1]) {
    const detail = wan[1].replace(/\s+/g, " ").trim();
    if (isToolJob(toolType)) {
      return `${toolLabel(toolType)}失败：${detail}`;
    }
    return `生成失败：${detail}`;
  }

  const firstLine = text.split("\n")[0]?.trim() ?? text;
  const clipped =
    firstLine.length > 160 ? `${firstLine.slice(0, 157)}…` : firstLine;
  if (isToolJob(toolType)) {
    return `${toolLabel(toolType)}失败：${clipped}`;
  }
  return clipped;
}
