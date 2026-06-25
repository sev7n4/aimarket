import { MoyuConfigError, MoyuError, MoyuNetworkError } from "./errors.js";
import { pollUntilTerminal, isTerminalStatus } from "./polling.js";
import type {
  CreateSessionInput,
  OpenSession,
  OpenApiError,
  PollOptions,
  StartDramaPlanInput,
  StartDramaProduceInput,
  WebhookRegisterInput,
  WebhookRegisterResult,
} from "./types.js";

/** MoyuClient 构造参数 */
export interface MoyuClientOptions {
  /** 必填，前缀为 `moyu_sk_` */
  apiKey: string;
  /** 服务端 base URL，默认 http://localhost:4100 */
  baseUrl?: string;
  /** 自定义 fetch（用于测试或代理），默认 globalThis.fetch */
  fetchImpl?: typeof fetch;
  /** 默认请求超时（毫秒），默认 30 秒 */
  timeoutMs?: number;
}

const DEFAULT_BASE_URL = "http://localhost:4100";
const DEFAULT_TIMEOUT_MS = 30_000;
const API_PREFIX = "/api/v1/open";

/**
 * moyupi OpenAPI 客户端。
 *
 * 用法：
 * ```ts
 * import { MoyuClient } from "@moyupi/skills";
 *
 * const client = new MoyuClient({
 *   apiKey: process.env.MOYU_API_KEY!,
 *   baseUrl: "https://api.moyupi.com",
 * });
 *
 * const session = await client.createSession({ title: "测试" });
 * const plan = await client.startDramaPlan({
 *   sessionId: session.id,
 *   userIdea: "一个关于咖啡师与诗人的短剧",
 * });
 * const result = await client.waitDramaPlan(plan.planRunId);
 * ```
 */
export class MoyuClient {
  readonly apiKey: string;
  readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(opts: MoyuClientOptions) {
    if (!opts.apiKey || !opts.apiKey.startsWith("moyu_sk_")) {
      throw new MoyuConfigError(
        "apiKey 必填且必须以 'moyu_sk_' 开头（在控制台生成）",
      );
    }
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** 健康检查 */
  async health(): Promise<{ ok: boolean; service: string; version: string }> {
    return this.requestJson("GET", "/health");
  }

  /** 创建 OpenAPI 会话 */
  async createSession(
    input: CreateSessionInput = {},
  ): Promise<OpenSession> {
    const body: CreateSessionInput = {
      mode: input.mode ?? "production",
      kind: input.kind ?? "canvas",
      ...input,
    };
    return this.requestJson("POST", `${API_PREFIX}/sessions`, body);
  }

  /** 获取会话详情 */
  async getSession(sessionId: string): Promise<OpenSession> {
    return this.requestJson("GET", `${API_PREFIX}/sessions/${sessionId}`);
  }

  /**
   * 启动短剧 Plan（5 Agent 协作编剧、分镜）。
   * 完成后通过 webhook 通知，或用 {@link waitDramaPlan} 轮询阻塞。
   */
  async startDramaPlan(
    input: StartDramaPlanInput,
  ): Promise<DramaPlanRunResult> {
    return this.requestJson("POST", `${API_PREFIX}/drama/plan`, input);
  }

  /**
   * 启动短剧 Produce（生成关键帧 / 视频 / 配音 / 字幕）。
   * 需要传入 {@link startDramaPlan} 返回的 projectId。
   */
  async startDramaProduce(
    input: StartDramaProduceInput,
  ): Promise<DramaProduceRunResult> {
    return this.requestJson("POST", `${API_PREFIX}/drama/produce`, input);
  }

  /** 注册 webhook */
  async registerWebhook(
    input: WebhookRegisterInput,
  ): Promise<WebhookRegisterResult> {
    return this.requestJson("POST", `${API_PREFIX}/webhooks`, input);
  }

  /**
   * 轮询等待 Drama Plan 完成（status 进入终态）。
   * 此方法使用 GET /sessions/:id 接口的 status 字段（间接信号）。
   * 若需精确等待 plan run 状态，建议使用 webhook。
   *
   * @param planRunId startDramaPlan 返回的 planRunId
   * @param opts 轮询选项
   * @returns 最终状态字符串
   */
  async waitDramaPlan(
    planRunId: string,
    opts: PollOptions = {},
  ): Promise<string> {
    // OpenAPI 暂未暴露 GET /plan-runs/:id 端点，
    // 这里通过 session 的 status 间接判断。
    // 实际生产建议用 webhook。
    return pollUntilTerminal(async () => {
      // 这里需要 planRunId 关联的 sessionId，
      // 调用方应自行用 waitDramaPlan 的 wrapper 或直接用 webhook。
      // 临时实现：返回 null 让用户必须用 webhook
      throw new MoyuConfigError(
        "waitDramaPlan 需要 sessionId 才能轮询。请使用 waitDramaSession 替代，或注册 webhook。",
      );
    }, opts);
  }

  /**
   * 通过 sessionId 轮询会话状态，直到进入终态。
   * 适合在 Plan/Produce 完成后由 webhook 触发的回查场景。
   */
  async waitDramaSession(
    sessionId: string,
    opts: PollOptions = {},
  ): Promise<string> {
    return pollUntilTerminal(async () => {
      const session = await this.getSession(sessionId);
      return session.status;
    }, opts);
  }

  /** 判断状态是否为终态（供调用方主动检查） */
  isTerminal(status: string | null | undefined): boolean {
    return isTerminalStatus(status);
  }

  /** 内部统一请求方法 */
  private async requestJson<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const init: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": this.apiKey,
      },
      signal: AbortSignal.timeout(this.timeoutMs),
    };
    if (body !== undefined && method !== "GET") {
      init.body = JSON.stringify(body);
    }

    let res: Response;
    try {
      res = await this.fetchImpl(url, init);
    } catch (err) {
      throw new MoyuNetworkError(
        `请求 ${method} ${path} 失败：${(err as Error).message}`,
        err,
      );
    }

    const text = await res.text();
    let parsed: unknown = undefined;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        // 非 JSON 响应
      }
    }

    if (!res.ok) {
      throw MoyuError.fromHttp(res.status, parsed as OpenApiError | undefined);
    }

    const data = (parsed as { data?: T } | undefined)?.data;
    if (data === undefined) {
      // /health 等端点直接返回顶层对象
      return parsed as T;
    }
    return data;
  }
}

/** startDramaPlan 返回值（对应 serializeDramaPlanRun） */
export interface DramaPlanRunResult {
  id: string;
  sessionId: string;
  userId: string;
  userIdea: string;
  projectType: string;
  status: string;
  projectId: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

/** startDramaProduce 返回值（对应 serializeDramaRun） */
export interface DramaProduceRunResult {
  id: string;
  sessionId: string;
  userId: string;
  projectId: string;
  status: string;
  error: string | null;
  estimatedPoints: number | null;
  finalVideoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}
