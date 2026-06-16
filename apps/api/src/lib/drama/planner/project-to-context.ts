import type { DramaProjectData } from "../schema.js";
import type {
  CinematographerOutput,
  CharacterOutput,
  DirectorOutput,
  PlanningContext,
  StoryboardOutput,
  WriterOutput,
} from "./types.js";

/** 将已落库的 DramaProjectData 还原为链式规划上下文（用于从指定 Agent 重跑） */
export function projectToPlanningContext(
  project: DramaProjectData,
): PlanningContext {
  const duration = project.targetDurationSec ?? 90;
  const aspectRatio =
    project.productionParams?.aspectRatio ??
    project.styleBible.aspectRatio ??
    "9:16";

  const writer: WriterOutput = {
    title: project.script.title,
    logline: project.script.logline,
    acts: project.script.acts,
    narratorLines: project.script.narratorLines ?? [],
    scenes: project.scenes,
    shots: project.shots.map((s) => ({
      id: s.id,
      order: s.order,
      sceneId: s.sceneId,
      characterIds: s.characterIds,
      dialogue: s.dialogue ?? [],
    })),
  };

  const director: DirectorOutput = {
    styleBible: project.styleBible,
  };

  const character: CharacterOutput = {
    characters: project.characters,
  };

  const cinematographer: CinematographerOutput = {
    shots: project.shots.map((s) => ({
      id: s.id,
      cameraSpec: s.cameraSpec,
      motionPrompt: s.motionPrompt,
    })),
  };

  const storyboard: StoryboardOutput = {
    shots: project.shots.map((s) => ({
      id: s.id,
      order: s.order,
      sceneId: s.sceneId,
      characterIds: s.characterIds,
      dialogue: s.dialogue ?? [],
      visualPrompt: s.visualPrompt,
      motionPrompt: s.motionPrompt,
      cameraSpec: s.cameraSpec,
      durationSec: s.durationSec,
      useLastFrameContinuity: s.useLastFrameContinuity ?? false,
    })),
  };

  return {
    input: {
      userIdea: project.userIdea,
      targetDurationSec: duration,
      aspectRatio,
    },
    duration,
    aspectRatio,
    writer,
    director,
    character,
    cinematographer,
    storyboard,
  };
}
