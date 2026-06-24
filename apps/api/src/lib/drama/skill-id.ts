import type { DramaProjectData } from "./schema.js";

export type DramaProjectType = DramaProjectData["projectType"];

export function resolveDramaSkillId(
  projectType: DramaProjectType = "short_drama",
): string {
  return projectType === "short_drama" ? "drama-short-v1" : "drama-mv-v1";
}
