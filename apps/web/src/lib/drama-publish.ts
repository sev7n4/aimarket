import type { DramaRun } from "@/lib/types";

/** 构建灵感发布 payload（PROD-A11） */
export function buildDramaPublishPayload(run: DramaRun) {
  const project = run.project;
  const title = project.script.title?.trim() || "AI 短剧";
  const prompt =
    project.script.logline?.trim() ||
    project.userIdea?.trim() ||
    title;
  const coverUrl =
    project.shots.find((s) => s.keyframeUrl)?.keyframeUrl ??
    project.shots.find((s) => s.videoUrl)?.videoUrl;

  const dramaTemplate = buildDramaTemplateMetadata(run);

  if (run.finalVideoOutputId) {
    return {
      outputId: run.finalVideoOutputId,
      title,
      prompt,
      aspectRatio: project.styleBible.aspectRatio,
      dramaTemplate,
      ...(coverUrl ? { coverUrl } : {}),
    };
  }

  if (!coverUrl) {
    throw new Error("缺少封面图，无法发布到灵感");
  }

  return {
    coverUrl,
    title,
    prompt,
    aspectRatio: project.styleBible.aspectRatio,
    dramaTemplate,
  };
}

/** 制片模板元数据（PROD-B06） */
export function buildDramaTemplateMetadata(run: DramaRun) {
  const project = run.project;
  return {
    userIdea: project.userIdea,
    projectType: project.projectType ?? "short_drama",
    targetDurationSec: project.targetDurationSec,
    aspectRatio: project.styleBible.aspectRatio,
    scriptTitle: project.script.title,
    logline: project.script.logline,
  };
}
