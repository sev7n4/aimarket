import { getDramaProject, parseProjectJson } from "./projects.js";
import type { DramaQcReport } from "./qc-report.js";
import { getDramaRun, parseProgress, updateDramaRun } from "./runs.js";

/** 质检完成后，对低于阈值的镜头自动 keyframe 重拍（PROD-C04） */
export async function applyAutoQcRetry(
  userId: string,
  runId: string,
  report: DramaQcReport,
): Promise<DramaQcReport> {
  if (report.status !== "completed") return report;

  const row = getDramaRun(userId, runId);
  if (!row) return report;

  const projectRow = getDramaProject(userId, row.project_id);
  if (!projectRow) return report;

  const project = parseProjectJson(projectRow);
  const params = project.productionParams;
  if (!params?.autoQcRetry) return report;

  const threshold = params.qcRetryThreshold ?? 70;
  const maxShots = params.qcAutoRetryMaxShots ?? 1;
  const progress = parseProgress(row);
  const already = new Set(progress.qcAutoRetriedShots ?? []);

  const lowShots = report.shots
    .filter((s) => s.overallScore < threshold && !already.has(s.shotId))
    .sort((a, b) => a.overallScore - b.overallScore)
    .slice(0, maxShots);

  if (!lowShots.length) return report;

  const target = lowShots[0]!;
  const enriched: DramaQcReport = {
    ...report,
    autoRetry: {
      triggered: true,
      threshold,
      retriedShotIds: [target.shotId],
      reason: `镜 ${target.order + 1} 得分 ${target.overallScore} < ${threshold}，自动重拍关键帧`,
    },
  };

  updateDramaRun(runId, {
    qcReport: enriched,
    progress: {
      ...progress,
      qcAutoRetriedShots: [...already, target.shotId],
    },
  });

  const { retryDramaShot } = await import("./executor.js");
  await retryDramaShot(userId, runId, target.shotId, "keyframe");
  return enriched;
}
