import { dramaProjectSchema, type DramaProjectData } from "../schema.js";
import { buildGlobalContextBlock } from "../prompt-builders.js";
import type { PlanningContext } from "./types.js";

export function mergePlanningContext(ctx: PlanningContext): DramaProjectData {
  const writer = ctx.writer!;
  const director = ctx.director!;
  const character = ctx.character!;
  const storyboard = ctx.storyboard!;
  const { input, duration, aspectRatio } = ctx;

  const camById = Object.fromEntries(
    (ctx.cinematographer?.shots ?? []).map((s) => [s.id, s]),
  );
  const writerShotById = Object.fromEntries(writer.shots.map((s) => [s.id, s]));

  const shots = storyboard.shots.map((s) => {
    const skeleton = writerShotById[s.id];
    const cam = camById[s.id];
    return {
      ...s,
      dialogue: s.dialogue ?? skeleton?.dialogue ?? [],
      motionPrompt: s.motionPrompt || cam?.motionPrompt || "缓慢推近",
      cameraSpec: s.cameraSpec ?? cam?.cameraSpec ?? {
        shotSize: "中景 MS",
        movement: "固定",
        lighting: director.styleBible.lightingStyle,
      },
      useLastFrameContinuity: s.useLastFrameContinuity ?? false,
      status: "pending" as const,
    };
  });

  const project = dramaProjectSchema.parse({
    projectType: input.projectType ?? "short_drama",
    userIdea: input.userIdea,
    targetDurationSec: duration,
    script: {
      title: writer.title,
      logline: writer.logline,
      acts: writer.acts,
      narratorLines: writer.narratorLines ?? [],
    },
    styleBible: director.styleBible,
    characters: character.characters,
    scenes: writer.scenes,
    shots,
    productionParams: {
      aspectRatio,
      imageModelId: "omni-v2",
      videoModelId: "wan-2.6",
      resolution: "1k",
      previewTier: "full",
    },
  });

  project.styleBible.globalContextBlock = buildGlobalContextBlock(
    project.styleBible,
    project.characters,
  );
  return project;
}
