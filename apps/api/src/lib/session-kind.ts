import { z } from "zod";

export const sessionKindSchema = z.enum(["canvas", "project"]);
export type SessionKind = z.infer<typeof sessionKindSchema>;

export const SESSION_KIND_LABEL: Record<SessionKind, string> = {
  canvas: "画布",
  project: "项目",
};
