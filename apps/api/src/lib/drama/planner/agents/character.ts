import { runAgentStep } from "../reasoning.js";
import { refineGuidance } from "../refine.js";
import { CHARACTER_JSON_SCHEMA } from "../schemas.js";
import type { AgentStepResult, CharacterOutput, PlanningContext } from "../types.js";

export async function runCharacterAgent(
  ctx: PlanningContext,
): Promise<AgentStepResult<CharacterOutput>> {
  const writer = ctx.writer!;
  const director = ctx.director!;
  const charIds = [
    ...new Set(writer.shots.flatMap((s) => s.characterIds)),
  ].sort();
  const { output, reasoning } = await runAgentStep<CharacterOutput>(
    "character",
    `你是 AI 短剧角色设计师（Anchor First）。
规则：
1. 为剧本中所有角色输出 characters，id 必须与分镜引用的 id 一致：${charIds.join(", ") || "char_1"}。
2. 每个角色 visualSignature 全字段 + 可生成三视图的 promptAnchor。
3. 1-4 个角色，不要删除已有 id。
4. 只输出 JSON。`,
    `标题：${writer.title}\n梗概：${writer.logline}\n风格：${director.styleBible.lightingStyle}，色板 ${director.styleBible.palette.join("、")}\n分镜角色引用：${charIds.join(", ")}${refineGuidance(ctx)}`,
    CHARACTER_JSON_SCHEMA,
  );
  return { output, reasoning };
}
