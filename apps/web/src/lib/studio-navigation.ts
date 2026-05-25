export type StudioKind = "canvas" | "project";

/** 统一新建画布 / 新建项目的跳转参数（与左侧栏、顶栏一致） */
export function buildStudioUrl(
  kind: StudioKind,
  options?: { sessionId?: string; mode?: string },
): string {
  const params = new URLSearchParams({
    sessionId: options?.sessionId ?? crypto.randomUUID(),
    mode: options?.mode ?? "chat",
    kind,
  });
  if (kind === "project") {
    params.set("title", "新建项目");
  }
  return `/studio?${params.toString()}`;
}
