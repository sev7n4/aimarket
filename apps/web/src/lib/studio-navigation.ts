import { randomUUID } from "@/lib/uuid";

export type StudioKind = "canvas" | "project";

/** 统一新建画布 / 新建项目的跳转参数（与左侧栏、顶栏一致） */
export function buildStudioUrl(
  kind: StudioKind,
  options?: {
    sessionId?: string;
    mode?: string;
    title?: string;
    prompt?: string;
    inspirationId?: string;
  },
): string {
  const params = new URLSearchParams({
    sessionId: options?.sessionId ?? randomUUID(),
    mode: options?.mode ?? "image",
    kind,
  });
  if (options?.title) {
    params.set("title", options.title);
  } else {
    params.set("title", "未命名");
  }
  if (options?.prompt) params.set("q", options.prompt);
  if (options?.inspirationId) {
    params.set("inspirationId", options.inspirationId);
  }
  return `/studio?${params.toString()}`;
}

export function studioUrlForSession(session: {
  id: string;
  mode: string;
  kind?: string;
}): string {
  const params = new URLSearchParams({
    sessionId: session.id,
    mode: session.mode,
    kind: session.kind === "project" ? "project" : "canvas",
  });
  return `/studio?${params.toString()}`;
}
