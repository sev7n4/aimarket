import { buildJobObservation } from "./job-observation.js";
import { resumeAgentRunOnJobCompleted } from "./runner.js";
import { resumeSkillRunOnJobCompleted } from "./skill-executor.js";

export { buildJobObservation } from "./job-observation.js";

export function notifyAgentJobCompleted(jobId: string) {
  const observation = buildJobObservation(jobId);
  if (!observation) return;

  void resumeAgentRunOnJobCompleted(jobId, observation).catch((err: unknown) => {
    console.warn("[agent] resume on job completed failed:", err);
  });

  void resumeSkillRunOnJobCompleted(jobId).catch((err: unknown) => {
    console.warn("[skill] resume on job completed failed:", err);
  });
}
