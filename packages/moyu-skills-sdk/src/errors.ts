import type { OpenApiError } from "./types.js";

/** SDK 错误基类 */
export class MoyuError extends Error {
  /** HTTP 状态码（网络错误时为 0） */
  readonly status: number;
  /** 服务端错误代码（如 UNAUTHORIZED / NOT_FOUND） */
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "MoyuError";
    this.status = status;
    this.code = code;
  }

  static fromHttp(status: number, body: OpenApiError | unknown): MoyuError {
    const errBody = (body as { error?: { code?: string; message?: string } })
      ?.error;
    const message = errBody?.message ?? `HTTP ${status}`;
    const code = errBody?.code ?? `HTTP_${status}`;
    return new MoyuError(message, status, code);
  }
}

/** 网络层错误（DNS 解析失败、连接超时等） */
export class MoyuNetworkError extends MoyuError {
  readonly cause: unknown;

  constructor(message: string, cause: unknown) {
    super(message, 0, "NETWORK_ERROR");
    this.name = "MoyuNetworkError";
    this.cause = cause;
  }
}

/** 轮询超时 */
export class MoyuTimeoutError extends MoyuError {
  readonly lastStatus: string | null;

  constructor(message: string, lastStatus: string | null) {
    super(message, 0, "TIMEOUT");
    this.name = "MoyuTimeoutError";
    this.lastStatus = lastStatus;
  }
}

/** 配置错误（如缺少 apiKey） */
export class MoyuConfigError extends MoyuError {
  constructor(message: string) {
    super(message, 0, "CONFIG_ERROR");
    this.name = "MoyuConfigError";
  }
}
