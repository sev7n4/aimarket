import { runAgentStep } from "../reasoning.js";
import { refineGuidance } from "../refine.js";
import { DIRECTOR_JSON_SCHEMA } from "../schemas.js";
import type { AgentStepResult, DirectorOutput, PlanningContext } from "../types.js";

function directorBrief(ctx: PlanningContext): string {
  const projectType = ctx.input.projectType ?? "short_drama";
  if (projectType === "mv") {
    return `你是 MV / 音乐短片导演，负责视觉风格圣经与 BGM 节奏感。
规则：
1. palette 偏霓虹/高饱和，lightingStyle 强调舞台感与节拍剪辑。
2. aspectRatio 必须为 ${ctx.aspectRatio}，单线叙事 60s 内，对白极少。
3. productionNotes 可注明 BGM 铺底与鼓点切镜。
4. 只输出 JSON。`;
  }
  if (projectType === "creative") {
    return `你是创意实验短片导演，负责非常规视觉风格圣经。
规则：
1. palette 可大胆撞色，lightingStyle 允许超现实/装置艺术感。
2. aspectRatio 必须为 ${ctx.aspectRatio}，叙事可碎片化但情绪连贯。
3. 只输出 JSON。`;
  }
  return `你是 AI 短剧专职导演，负责视觉风格圣经 styleBible 与制作备注。
规则：
1. palette 至少 2 色，lightingStyle/negativePrompt 具体可执行。
2. aspectRatio 必须为 ${ctx.aspectRatio}。
3. 情绪节奏与编剧 acts 一致，可写 productionNotes。
4. 只输出 JSON。`;
}

export async function runDirectorAgent(
  ctx: PlanningContext,
): Promise<AgentStepResult<DirectorOutput>> {
  const writer = ctx.writer!;
  const { aspectRatio } = ctx;
  const { output, reasoning } = await runAgentStep<DirectorOutput>(
    "director",
    directorBrief(ctx),
    `剧本标题：${writer.title}\n梗概：${writer.logline}\n场次：${JSON.stringify(writer.acts)}\n场景：${writer.scenes.map((s) => s.name).join("、")}${refineGuidance(ctx)}`,
    DIRECTOR_JSON_SCHEMA,
  );
  output.styleBible.aspectRatio = aspectRatio;
  return { output, reasoning };
}
