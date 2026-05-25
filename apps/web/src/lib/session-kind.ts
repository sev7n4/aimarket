export type SessionKind = "canvas" | "project";

export const SESSION_KIND_LABEL: Record<SessionKind, string> = {
  canvas: "画布",
  project: "项目",
};

export function parseSessionKind(
  value: string | undefined,
): SessionKind | undefined {
  if (value === "canvas" || value === "project") return value;
  return undefined;
}
