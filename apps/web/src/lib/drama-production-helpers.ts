import type { DramaPipelineStepView, DramaRun, DramaStoryboardShot } from "@/lib/types";

export type ShotTrackState = "pending" | "active" | "done" | "failed";

export const SHOT_TRACK_SYMBOL: Record<ShotTrackState, string> = {
  pending: "○",
  active: "…",
  done: "✓",
  failed: "✗",
};

const STEP_SHOT_LABEL: Record<string, string> = {
  keyframes: "生成关键帧",
  shot_videos: "生成视频",
  tts: "配音",
  lipsync: "口型同步",
};

export function sortShots(shots: DramaStoryboardShot[]) {
  return [...shots].sort((a, b) => a.order - b.order);
}

export function isDramaRunProducing(run: DramaRun): boolean {
  return ![
    "completed",
    "failed",
    "cancelled",
    "waiting_confirm",
  ].includes(run.status);
}

export function computeProductionPercent(run: DramaRun): number {
  if (run.status === "completed") return 100;
  const shots = run.project.shots;
  if (!shots.length) return 0;

  const done = shots.filter((s) => s.status === "done").length;
  const inProgress = shots.filter((s) =>
    ["keyframe", "video", "audio"].includes(s.status),
  ).length;
  const shotPart = ((done + inProgress * 0.45) / shots.length) * 72;
  const pipelinePart =
    (run.currentStepIndex / Math.max(run.pipelineSteps.length, 1)) * 28;
  return Math.min(run.status === "failed" ? 99 : 98, Math.round(shotPart + pipelinePart));
}

export function shotTrackState(
  shot: DramaStoryboardShot,
  run: DramaRun,
): ShotTrackState {
  if (shot.status === "failed") return "failed";
  if (shot.status === "done") return "done";

  const activeStep = run.pipelineSteps.find((s) => s.current);
  const shotIndex = run.progress?.shotIndex ?? run.currentStepIndex;
  const isShotStep =
    activeStep?.id === "keyframes" ||
    activeStep?.id === "shot_videos" ||
    activeStep?.id === "tts" ||
    activeStep?.id === "lipsync";

  if (
    isShotStep &&
    isDramaRunProducing(run) &&
    shot.order === shotIndex
  ) {
    return "active";
  }

  if (["keyframe", "video", "audio"].includes(shot.status)) {
    return "done";
  }

  return "pending";
}

export function currentProductionLabel(run: DramaRun): string | null {
  const active = run.pipelineSteps.find((s) => s.current);
  if (!active) {
    if (run.status === "completed") return "制作完成";
    if (run.status === "failed") return "制作失败";
    return null;
  }

  const shotNum = (run.progress?.shotIndex ?? 0) + 1;
  const shotLabel = STEP_SHOT_LABEL[active.id];
  if (shotLabel) return `S${shotNum} ${shotLabel}`;
  return active.label;
}

export function activePipelineStep(
  run: DramaRun,
): DramaPipelineStepView | undefined {
  return (
    run.pipelineSteps.find((s) => s.current) ??
    (run.status === "failed"
      ? run.pipelineSteps.find((s) => s.index === run.currentStepIndex)
      : undefined)
  );
}
