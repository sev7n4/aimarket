/**
 * @moyupi/skills — moyupi 出图宝 OpenAPI SDK
 *
 * 外部 Agent 通过此 SDK 调用 moyupi 短剧 Plan / Produce 能力，
 * 并接收 webhook 回调。
 *
 * @example
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
 * console.log("plan:", plan.id, plan.status);
 * ```
 *
 * @packageDocumentation
 */

export { MoyuClient } from "./client.js";
export type {
  MoyuClientOptions,
  DramaPlanRunResult,
  DramaProduceRunResult,
} from "./client.js";

export {
  MoyuError,
  MoyuNetworkError,
  MoyuTimeoutError,
  MoyuConfigError,
} from "./errors.js";

export {
  MoyuWebhook,
  isWebhookEvent,
} from "./webhooks.js";
export type {
  MoyuWebhookEventPayload,
  WebhookEventData,
} from "./webhooks.js";

export { isTerminalStatus, pollUntilTerminal, sleep } from "./polling.js";

export type {
  CreateSessionInput,
  DramaProjectType,
  OpenApiError,
  OpenSession,
  OpenSessionKind,
  OpenSessionMode,
  OpenWebhookEvent,
  PollOptions,
  StartDramaPlanInput,
  StartDramaProduceInput,
  WebhookRegisterInput,
  WebhookRegisterResult,
} from "./types.js";

/** SDK 版本号（与 package.json 同步） */
export const SDK_VERSION = "0.1.0";
