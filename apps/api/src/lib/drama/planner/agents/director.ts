import { runAgentStep } from "../reasoning.js";
import { DIRECTOR_JSON_SCHEMA } from "../schemas.js";
import type { AgentStepResult, DirectorOutput, PlanningContext } from "../types.js";

export async function runDirectorAgent(
  ctx: PlanningContext,
): Promise<AgentStepResult<DirectorOutput>> {
  const writer = ctx.writer!;
  const { aspectRatio } = ctx;
  const { output, reasoning } = await runAgentStep<DirectorOutput>(
    "director",
    `你是 AI 短剧专职导演，负责视觉风格圣经 styleBible 与制作备注。
规则：
1. palette 至少 2 色，lightingStyle/negativePrompt 具体可执行。
2. aspectRatio 必须为 ${aspectRatio}。
3. 情绪节奏与编剧 acts 一致，可写 productionNotes。
4. 只输出 JSON。`,
    `剧本标题：${writer.title}\n梗概：${writer.logline}\n场次：${JSON.stringify(writer.acts)}\n场景：${writer.scenes.map((s) => s.name).join("、")}`,
    DIRECTOR_JSON_SCHEMA,
  );
  output.styleBible.aspectRatio = aspectRatio;
  return { output, reasoning };
}
