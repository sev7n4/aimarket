import { createHmac, timingSafeEqual } from "node:crypto";
import type { OpenWebhookEvent } from "./types.js";

/**
 * Webhook 签名验证工具。
 *
 * 服务端使用 HMAC-SHA256 + secret 对 raw body 进行签名，
 * 放在请求头 X-Moyu-Signature（hex）中。
 *
 * 用法：
 * ```ts
 * import { MoyuWebhook } from "@moyupi/skills";
 *
 * const sig = req.headers["x-moyu-signature"] as string;
 * if (!MoyuWebhook.verify(rawBody, sig, secret)) {
 *   return res.status(401).json({ error: "invalid signature" });
 * }
 * const event = JSON.parse(rawBody) as MoyuWebhookEventPayload;
 * ```
 */
export const MoyuWebhook = {
  /**
   * 计算给定 body 和 secret 的 HMAC-SHA256 签名（hex）。
   * 用于调试或测试，运行时通常用 {@link verify} 即可。
   */
  sign(body: string, secret: string): string {
    return createHmac("sha256", secret).update(body).digest("hex");
  },

  /**
   * 校验请求签名，使用 timingSafeEqual 防止时序攻击。
   *
   * @param rawBody 原始请求体字符串（务必用 raw body，未经过 JSON.parse）
   * @param signature 请求头 X-Moyu-Signature 的值
   * @param secret 注册 webhook 时返回的 secret
   */
  verify(rawBody: string, signature: string, secret: string): boolean {
    if (!signature || !secret) return false;
    const expected = this.sign(rawBody, secret);
    if (expected.length !== signature.length) return false;
    try {
      return timingSafeEqual(
        Buffer.from(expected),
        Buffer.from(signature),
      );
    } catch {
      return false;
    }
  },
};

/** Webhook payload 结构（服务端 POST 到注册 URL 的 body） */
export interface MoyuWebhookEventPayload<
  T extends OpenWebhookEvent = OpenWebhookEvent,
> {
  event: T;
  timestamp: string;
  data: WebhookEventData<T>;
}

/** 各事件对应的 data 结构 */
export interface WebhookEventData<T extends OpenWebhookEvent> {
  planRunId?: string;
  runId?: string;
  sessionId: string;
  projectId?: string | null;
  status: string;
  error?: string | null;
  finalVideoUrl?: string | null;
}

/** 类型守卫：判断 payload 是否为某种事件 */
export function isWebhookEvent<T extends OpenWebhookEvent>(
  payload: MoyuWebhookEventPayload,
  event: T,
): payload is MoyuWebhookEventPayload<T> {
  return payload.event === event;
}
