import type { DramaProjectData } from "../schema.js";
import type { PlanDramaInput } from "./types.js";
import { runCharacterAgent } from "./agents/character.js";
import { runCinematographerAgent } from "./agents/cinematographer.js";
import { runDirectorAgent } from "./agents/director.js";
import { runStoryboardAgent } from "./agents/storyboard.js";
import { runWriterAgent } from "./agents/writer.js";
import { mergePlanningContext } from "./merge.js";
import type {
  AgentStepResult,
  CharacterOutput,
  CinematographerOutput,
  DirectorOutput,
  DramaPlanAgentId,
  DramaPlanEmit,
  PlanningContext,
  StoryboardOutput,
  WriterOutput,
} from "./types.js";

function summarizeAgent(agent: DramaPlanAgentId, output: unknown): string {
  switch (agent) {
    case "writer": {
      const w = output as WriterOutput;
      return `${w.title} · ${w.shots.length} 镜 · ${w.acts.length} 幕`;
    }
    case "director": {
      const d = output as DirectorOutput;
      return `${d.styleBible.lightingStyle} · ${d.styleBible.palette.join("、")}`;
    }
    case "character": {
      const c = output as CharacterOutput;
      return c.characters.map((ch) => ch.name).join("、");
    }
    case "cinematographer": {
      const c = output as CinematographerOutput;
      return `${c.shots.length} 镜摄影方案`;
    }
    case "storyboard": {
      const s = output as StoryboardOutput;
      return `${s.shots.length} 镜分镜完成`;
    }
    default:
      return "完成";
  }
}

async function runAgentStep<T>(
  agent: DramaPlanAgentId,
  ctx: PlanningContext,
  runner: (ctx: PlanningContext) => Promise<AgentStepResult<T>>,
  apply: (ctx: PlanningContext, output: T) => void,
  emit?: DramaPlanEmit,
): Promise<AgentStepResult<T>> {
  emit?.({ type: "agent_start", agent });
  const result = await runner(ctx);
  apply(ctx, result.output);
  if (result.reasoning) {
    emit?.({ type: "agent_reasoning", agent, chunk: result.reasoning });
  }
  emit?.({
    type: "agent_done",
    agent,
    summary: summarizeAgent(agent, result.output),
  });
  return result;
}

export async function planDramaProjectMultiAgentWithEvents(
  input: PlanDramaInput,
  emit?: DramaPlanEmit,
): Promise<DramaProjectData> {
  const duration = input.targetDurationSec ?? 90;
  const aspectRatio = input.aspectRatio ?? "9:16";
  const ctx: PlanningContext = { input, duration, aspectRatio };

  await runAgentStep("writer", ctx, runWriterAgent, (c, o) => {
    c.writer = o;
  }, emit);
  await runAgentStep("director", ctx, runDirectorAgent, (c, o) => {
    c.director = o;
  }, emit);
  await runAgentStep("character", ctx, runCharacterAgent, (c, o) => {
    c.character = o;
  }, emit);
  await runAgentStep(
    "cinematographer",
    ctx,
    runCinematographerAgent,
    (c, o) => {
      c.cinematographer = o;
    },
    emit,
  );
  await runAgentStep("storyboard", ctx, runStoryboardAgent, (c, o) => {
    c.storyboard = o;
  }, emit);

  return mergePlanningContext(ctx);
}

export async function planDramaProjectMultiAgent(
  input: PlanDramaInput,
): Promise<DramaProjectData> {
  return planDramaProjectMultiAgentWithEvents(input);
}
