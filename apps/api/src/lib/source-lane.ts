/** Studio 创作 Dock 车道溯源（写入 generation_jobs.source_lane） */
export const SOURCE_LANE_VALUES = ["agent", "image", "video"] as const;
export type SourceLane = (typeof SOURCE_LANE_VALUES)[number];

export function parseSourceLane(value: unknown): SourceLane | null {
  if (value === "agent" || value === "image" || value === "video") {
    return value;
  }
  return null;
}

export function inferSourceLane(input: {
  sourceLane?: SourceLane | null;
  toolType?: string | null;
}): SourceLane | null {
  const explicit = parseSourceLane(input.sourceLane);
  if (explicit) return explicit;
  if (input.toolType === "video") return "video";
  return null;
}

/** Skill 步骤溯源：套图/工具步骤归 Agent 车道，视频步骤归视频车道 */
export function inferSkillStepSourceLane(step: { type: string }): SourceLane {
  return step.type === "video" ? "video" : "agent";
}
