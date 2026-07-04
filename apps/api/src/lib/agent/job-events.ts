import { buildJobObservation } from "./job-observation.js";
import { resumeAgentRunOnJobCompleted } from "./runner.js";
import { resumeSkillRunOnJobCompleted } from "./skill-executor.js";
import { resumeCharacterTurnaroundOnJobCompleted } from "../drama/character-turnaround.js";
import { notifyPlanningTurnaroundProgress } from "../drama/planning-character-assets.js";
import { resumeDramaRunOnJobCompleted } from "../drama/executor.js";

export { buildJobObservation } from "./job-observation.js";

export function notifyAgentJobCompleted(jobId: string) {
  const observation = buildJobObservation(jobId);
  if (!observation) return;

  void resumeAgentRunOnJobCompleted(jobId, observation).catch((err) => {
    console.warn("[agent] resume on job completed failed:", err);
  });

  void resumeSkillRunOnJobCompleted(jobId).catch((err) => {
    console.warn("[skill] resume on job completed failed:", err);
  });

  void resumeDramaRunOnJobCompleted(jobId).catch((err) => {
    console.warn("[drama] resume on job completed failed:", err);
  });

  void resumeCharacterTurnaroundOnJobCompleted(jobId)
    .then((result) => {
      if (!result) return;
      notifyPlanningTurnaroundProgress(
        result.userId,
        result.projectId,
        result.characterId,
      );
    })
    .catch((err) => {
      console.warn("[drama] turnaround resume on job completed failed:", err);
    });
}
