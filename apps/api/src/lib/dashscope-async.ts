/**
 * DashScope 异步图像任务（万相 image-synthesis 等）
 * 文档：https://help.aliyun.com/zh/model-studio/wanx-image-edit-api-reference
 */

export interface DashScopeTaskOutput {
  task_id?: string;
  task_status?: string;
  results?: { url?: string }[];
  code?: string;
  message?: string;
}

export interface DashScopeTaskResponse {
  output?: DashScopeTaskOutput;
  code?: string;
  message?: string;
}

export function dashScopeBaseUrl(): string {
  return (
    process.env.DASHSCOPE_BASE_URL ?? "https://dashscope.aliyuncs.com"
  ).replace(/\/$/, "");
}

export async function submitDashScopeImageSynthesis(
  payload: Record<string, unknown>,
): Promise<string> {
  const apiKey = process.env.DASHSCOPE_API_KEY?.trim();
  if (!apiKey) throw new Error("DASHSCOPE_API_KEY 未配置");

  const base = dashScopeBaseUrl();
  const res = await fetch(
    `${base}/api/v1/services/aigc/image2image/image-synthesis`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60_000),
    },
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `DashScope 鉴权失败 (${res.status}): ${errText.slice(0, 300)}`,
      );
    }
    throw new Error(
      `DashScope image-synthesis 提交失败 (${res.status}): ${errText.slice(0, 300)}`,
    );
  }

  const json = (await res.json()) as DashScopeTaskResponse;
  if (json.code) {
    throw new Error(`DashScope 业务错误 ${json.code}: ${json.message ?? ""}`);
  }

  const taskId = json.output?.task_id;
  if (!taskId) {
    throw new Error("DashScope 未返回 task_id");
  }
  return taskId;
}

export async function pollDashScopeTask(
  taskId: string,
  options?: { timeoutMs?: number; intervalMs?: number },
): Promise<string[]> {
  const apiKey = process.env.DASHSCOPE_API_KEY?.trim();
  if (!apiKey) throw new Error("DASHSCOPE_API_KEY 未配置");

  const base = dashScopeBaseUrl();
  const timeoutMs = options?.timeoutMs ?? 180_000;
  const intervalMs = options?.intervalMs ?? 2_000;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const res = await fetch(`${base}/api/v1/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(
        `DashScope 任务查询失败 (${res.status}): ${errText.slice(0, 200)}`,
      );
    }

    const json = (await res.json()) as DashScopeTaskResponse;
    const status = json.output?.task_status;

    if (status === "SUCCEEDED") {
      const urls = (json.output?.results ?? [])
        .map((r) => r.url)
        .filter((u): u is string => typeof u === "string" && u.length > 0);
      if (urls.length === 0) {
        throw new Error("DashScope 任务成功但缺少图片 URL");
      }
      return urls;
    }

    if (status === "FAILED" || status === "CANCELED") {
      const code = json.output?.code ?? json.code;
      const message =
        json.output?.message ?? json.message ?? `DashScope 任务失败 (${status})`;
      if (
        code === "InvalidApiKey" ||
        code === "AccessDenied" ||
        /invalidapikey|access.denied|unauthorized/i.test(message)
      ) {
        throw new Error(`DashScope 鉴权失败 (${code ?? status}): ${message}`);
      }
      throw new Error(message);
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error("DashScope 任务超时");
}
