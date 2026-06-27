/**
 * 工具执行失败时的自动重试与参数调整，以及用户反馈学习的基础设施
 */

// ─── 工具重试策略 ────────────────────────────────────────────────

/** 工具重试策略 */
export interface ToolRetryStrategy {
  /** 最大重试次数 */
  maxRetries: number;
  /** 重试间隔基础值（ms） */
  baseDelayMs: number;
  /** 是否应调整参数后重试 */
  shouldAdjustParams: boolean;
  /** 参数调整函数 */
  adjustParams?: (
    params: Record<string, unknown>,
    attempt: number,
    error: Error,
  ) => ToolRunParamsAdjustment;
}

/** 参数调整描述 */
export interface ToolRunParamsAdjustment {
  /** 调整后的 prompt（可添加约束词） */
  prompt?: string;
  /** 调整后的提示（供日志使用） */
  hint?: string;
}

/** 根据工具 ID 和错误类型推断重试策略 */
export function inferRetryStrategy(
  toolId: string,
  error: Error,
): ToolRetryStrategy {
  const msg = error.message ?? "";

  // 超时类错误
  if (/超时|timeout|ETIMEDOUT/i.test(msg)) {
    return {
      maxRetries: 1,
      baseDelayMs: 3000,
      shouldAdjustParams: false,
    };
  }

  // 配额错误 — 不重试
  if (/配额|quota|429/.test(msg)) {
    return {
      maxRetries: 0,
      baseDelayMs: 0,
      shouldAdjustParams: false,
    };
  }

  // 鉴权错误 — 不重试
  if (/鉴权|auth|401|403/.test(msg)) {
    return {
      maxRetries: 0,
      baseDelayMs: 0,
      shouldAdjustParams: false,
    };
  }

  // 质量类错误 — 重试并调整参数
  if (/质量|返回缺少|无图片/.test(msg)) {
    return {
      maxRetries: 1,
      baseDelayMs: 2000,
      shouldAdjustParams: true,
      adjustParams: (params, _attempt, _error) => {
        const original = typeof params.prompt === "string" ? params.prompt : "";
        return {
          prompt: original + "。请确保输出完整且质量达标。",
          hint: "追加质量约束提示词",
        };
      },
    };
  }

  // 网络错误
  if (/ECONNRESET|ENOTFOUND|fetch failed/i.test(msg)) {
    return {
      maxRetries: 2,
      baseDelayMs: 5000,
      shouldAdjustParams: false,
    };
  }

  // 默认策略
  return {
    maxRetries: 1,
    baseDelayMs: 2000,
    shouldAdjustParams: false,
  };
}

// ─── 用户反馈记录 ────────────────────────────────────────────────

/** 用户对工具执行结果的反馈类型 */
export type ToolFeedbackType =
  | "regenerate"
  | "favorite"
  | "download"
  | "dismiss";

/** 工具执行反馈记录 */
export interface ToolFeedbackRecord {
  /** Job ID */
  jobId: string;
  /** 用户 ID */
  userId: string;
  /** 工具 ID */
  toolId: string;
  /** Provider 名称 */
  providerName: string;
  /** 反馈类型 */
  feedback: ToolFeedbackType;
  /** 时间戳 */
  timestamp: string;
}

/** 模块级内存存储（生产环境可替换为数据库） */
const feedbackStore = new Map<string, ToolFeedbackRecord[]>();

/** 生成存储键 */
function feedbackKey(toolId: string, providerName: string): string {
  return `${toolId}::${providerName}`;
}

/** 记录用户反馈 */
export function recordToolFeedback(record: ToolFeedbackRecord): void {
  const key = feedbackKey(record.toolId, record.providerName);
  const list = feedbackStore.get(key) ?? [];
  list.push(record);
  feedbackStore.set(key, list);
}

/** 查询某工具+Provider 的反馈统计 */
export function getToolFeedbackStats(
  toolId: string,
  providerName: string,
): {
  regenerateRate: number;
  favoriteRate: number;
  totalFeedbacks: number;
} {
  const key = feedbackKey(toolId, providerName);
  const list = feedbackStore.get(key) ?? [];

  const totalFeedbacks = list.length;
  if (totalFeedbacks === 0) {
    return { regenerateRate: 0, favoriteRate: 0, totalFeedbacks: 0 };
  }

  const regenerateCount = list.filter(
    (r) => r.feedback === "regenerate",
  ).length;
  const favoriteCount = list.filter((r) => r.feedback === "favorite").length;

  return {
    regenerateRate: regenerateCount / totalFeedbacks,
    favoriteRate: favoriteCount / totalFeedbacks,
    totalFeedbacks,
  };
}

// ─── 反馈驱动的 Provider 评分 ──────────────────────────────────

/** 根据反馈数据计算 Provider 评分（0-1，越高越好） */
export function feedbackAwareProviderScore(
  toolId: string,
  providerName: string,
): number {
  const stats = getToolFeedbackStats(toolId, providerName);

  // 数据不足时不偏倚
  if (stats.totalFeedbacks < 5) {
    return 0.5;
  }

  // 基础分：重生成越多分越低
  const baseScore = 1 - stats.regenerateRate * 0.5;
  // 加分：收藏越多分越高
  const bonus = stats.favoriteRate * 0.3;

  return Math.min(Math.max(baseScore + bonus, 0), 1);
}
