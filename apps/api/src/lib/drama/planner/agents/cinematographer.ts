import { runAgentStep } from "../reasoning.js";
import { CINEMATOGRAPHER_JSON_SCHEMA } from "../schemas.js";
import type {
  AgentStepResult,
  CinematographerOutput,
  PlanningContext,
} from "../types.js";

export async function runCinematographerAgent(
  ctx: PlanningContext,
): Promise<AgentStepResult<CinematographerOutput>> {
  const writer = ctx.writer!;
  const director = ctx.director!;
  const shotSummary = writer.shots
    .map(
      (s) =>
        `${s.id}: scene=${s.sceneId} chars=${s.characterIds.join(",")} dialogue=${s.dialogue.length}`,
    )
    .join("\n");
  const { output, reasoning } = await runAgentStep<CinematographerOutput>(
    "cinematographer",
    `你是 AI 短剧摄影指导。
规则：
1. 为每个分镜 id 输出 cameraSpec（shotSize/movement/lighting）与 motionPrompt。
2. 不得增删 shot id，必须与编剧骨架一致。
3. 同场景连续镜头运动宜连贯；风格遵循导演 styleBible。
4. 只输出 JSON。`,
    `光影风格：${director.styleBible.lightingStyle}\n色温倾向：${director.styleBible.palette.join("、")}\n分镜骨架：\n${shotSummary}`,
    CINEMATOGRAPHER_JSON_SCHEMA,
  );
  return { output, reasoning };
}
