import { dramaProjectSchema, type DramaProjectData } from "../schema.js";
import { buildGlobalContextBlock } from "../prompt-builders.js";
import type { PlanningContext } from "./types.js";

function buildPartialShots(ctx: PlanningContext): DramaProjectData["shots"] {
  const writer = ctx.writer!;
  const director = ctx.director;
  const camById = Object.fromEntries(
    (ctx.cinematographer?.shots ?? []).map((s) => [s.id, s]),
  );
  const writerShotById = Object.fromEntries(writer.shots.map((s) => [s.id, s]));

  if (ctx.storyboard) {
    return ctx.storyboard.shots.map((s) => {
      const skeleton = writerShotById[s.id];
      const cam = camById[s.id];
      return {
        ...s,
        dialogue: s.dialogue ?? skeleton?.dialogue ?? [],
        motionPrompt: s.motionPrompt || cam?.motionPrompt || "缓慢推近",
        cameraSpec: s.cameraSpec ?? cam?.cameraSpec ?? {
          shotSize: "中景 MS",
          movement: "固定",
          lighting: director?.styleBible.lightingStyle ?? "自然光",
        },
        useLastFrameContinuity: s.useLastFrameContinuity ?? false,
        status: "pending" as const,
      };
    });
  }

  return writer.shots.map((s) => ({
    id: s.id,
    order: s.order,
    sceneId: s.sceneId,
    characterIds: s.characterIds,
    dialogue: s.dialogue,
    visualPrompt: "分镜生成中…",
    motionPrompt: camById[s.id]?.motionPrompt ?? "缓慢推近",
    cameraSpec: camById[s.id]?.cameraSpec ?? {
      shotSize: "中景 MS",
      movement: "固定",
      lighting: director?.styleBible.lightingStyle ?? "自然光",
    },
    durationSec: 3,
    useLastFrameContinuity: false,
    status: "pending" as const,
  }));
}

/** 规划中途快照：按已完成 Agent 合并可用字段（不要求 shots 数量达标） */
export function mergePartialPlanningContext(
  ctx: PlanningContext,
): DramaProjectData | null {
  if (!ctx.writer) return null;
  if (ctx.storyboard && ctx.cinematographer && ctx.character && ctx.director) {
    return mergePlanningContext(ctx);
  }

  const { input, duration, aspectRatio } = ctx;
  const writer = ctx.writer;
  const styleBible =
    ctx.director?.styleBible ??
    ({
      palette: [],
      lightingStyle: "美术风格生成中…",
      aspectRatio,
      negativePrompt: "",
    } satisfies DramaProjectData["styleBible"]);

  const project: DramaProjectData = {
    projectType: input.projectType ?? "short_drama",
    userIdea: input.userIdea,
    targetDurationSec: duration,
    script: {
      title: writer.title,
      logline: writer.logline,
      acts: writer.acts,
      narratorLines: writer.narratorLines ?? [],
    },
    styleBible,
    characters: ctx.character?.characters ?? [],
    scenes: writer.scenes,
    shots: buildPartialShots(ctx),
    productionParams: {
      aspectRatio,
      imageModelId: "omni-v2",
      videoModelId: "wan-2.6",
      resolution: "1k",
      previewTier: "full",
      autoQcRetry: false,
      qcRetryThreshold: 70,
      qcAutoRetryMaxShots: 1,
    },
  };

  if (ctx.director?.styleBible && project.characters.length > 0) {
    project.styleBible.globalContextBlock = buildGlobalContextBlock(
      project.styleBible,
      project.characters,
    );
  }

  return project;
}

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
