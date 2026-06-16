import type { DramaProjectData } from "../schema.js";
import type { PlanDramaInput } from "./types.js";
import { runCharacterAgent } from "./agents/character.js";
import { runCinematographerAgent } from "./agents/cinematographer.js";
import { runDirectorAgent } from "./agents/director.js";
import { runStoryboardAgent } from "./agents/storyboard.js";
import { runWriterAgent } from "./agents/writer.js";
import { mergePlanningContext } from "./merge.js";
import type { PlanningContext } from "./types.js";

export async function planDramaProjectMultiAgent(
  input: PlanDramaInput,
): Promise<DramaProjectData> {
  const duration = input.targetDurationSec ?? 90;
  const aspectRatio = input.aspectRatio ?? "9:16";
  const ctx: PlanningContext = { input, duration, aspectRatio };

  const writerResult = await runWriterAgent(ctx);
  ctx.writer = writerResult.output;

  const directorResult = await runDirectorAgent(ctx);
  ctx.director = directorResult.output;

  const characterResult = await runCharacterAgent(ctx);
  ctx.character = characterResult.output;

  const cinematographerResult = await runCinematographerAgent(ctx);
  ctx.cinematographer = cinematographerResult.output;

  const storyboardResult = await runStoryboardAgent(ctx);
  ctx.storyboard = storyboardResult.output;

  return mergePlanningContext(ctx);
}
