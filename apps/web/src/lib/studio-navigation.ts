import {
  allocateDraftSessionId,
  getOrCreateDraftSessionId,
} from "@/lib/studio-draft-session";

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
    workspaceId?: string | null;
    /**
     * 未传 sessionId 时：true=新草稿 ID（不入库）；false=复用 localStorage 草稿。
     * 默认 true。
     */
    newDraft?: boolean;
  },
): string {
  const sessionId =
    options?.sessionId ??
    (options?.newDraft === false
      ? getOrCreateDraftSessionId(options?.workspaceId)
      : allocateDraftSessionId(options?.workspaceId));
  const params = new URLSearchParams({
    sessionId,
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
  const normalizedMode =
    session.mode === "production" || session.mode === "ecommerce"
      ? "image"
      : session.mode;
  const params = new URLSearchParams({
    sessionId: session.id,
    mode: normalizedMode,
    kind: session.kind === "project" ? "project" : "canvas",
  });
  return `/studio?${params.toString()}`;
}
