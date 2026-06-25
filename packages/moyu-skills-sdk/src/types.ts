/**
 * @moyupi/skills — 类型定义
 *
 * 这些类型严格对应 apps/api OpenAPI 路由的请求/响应结构。
 * 详见 apps/api/src/routes/open.ts 与 src/lib/open-*.ts。
 */

/** OpenAPI 会话模式 */
export type OpenSessionMode = "chat" | "image" | "ecommerce" | "production";

/** OpenAPI 会话种类（影响默认画布 / 项目） */
export type OpenSessionKind = "canvas" | "project";

export interface OpenSession {
  id: string;
  title: string | null;
  mode: OpenSessionMode;
  kind: OpenSessionKind;
  status: string;
  workspaceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSessionInput {
  /** 默认 "production" */
  mode?: OpenSessionMode;
  title?: string;
  /** 默认 "canvas" */
  kind?: OpenSessionKind;
  workspaceId?: string;
}

/** 短剧项目类型 */
export type DramaProjectType = "short_drama" | "mv" | "creative";

export interface StartDramaPlanInput {
  /** 必填，需先通过 createSession 创建 */
  sessionId: string;
  /** 用户创意，10-2000 字 */
  userIdea: string;
  /** 目标时长（秒），默认 60-180 之间 */
  targetDurationSec?: number;
  /** 宽高比，默认 9:16 */
  aspectRatio?: "9:16" | "16:9";
  /** 是否自动开始 Produce，默认 false */
  autoProduce?: boolean;
  /** 项目类型，默认 "short_drama" */
  projectType?: DramaProjectType;
}

export interface StartDramaProduceInput {
  sessionId: string;
  projectId: string;
  /** 是否已确认积分扣费，默认 true */
  confirmed?: boolean;
}

/** Webhook 事件类型 */
export type OpenWebhookEvent =
  | "drama.plan.completed"
  | "drama.plan.failed"
  | "drama.run.completed"
  | "drama.run.failed";

export interface WebhookRegisterInput {
  url: string;
  events: OpenWebhookEvent[];
  /** 用于签名校验的密钥，可选，未提供时由服务端生成 */
  secret?: string;
}

export interface WebhookRegisterResult {
  id: string;
  url: string;
  events: OpenWebhookEvent[];
  hasSecret: boolean;
  createdAt: string;
  /** 仅在创建时返回一次，后续无法读取 */
  secret?: string;
}

/** OpenAPI 错误响应体 */
export interface OpenApiError {
  error: {
    code: string;
    message: string;
  };
}

/** 轮询选项 */
export interface PollOptions {
  /** 总超时（毫秒），默认 5 分钟 */
  timeoutMs?: number;
  /** 轮询间隔（毫秒），默认 3 秒 */
  pollIntervalMs?: number;
  /** 中途回调，便于 UI 展示进度 */
  onProgress?: (status: string) => void;
  /** 自定义中止信号 */
  signal?: AbortSignal;
}
