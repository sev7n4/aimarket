import { runAgentStep } from "../reasoning.js";
import { refineGuidance } from "../refine.js";
import { WRITER_JSON_SCHEMA } from "../schemas.js";
import type { AgentStepResult, PlanningContext, WriterOutput } from "../types.js";

export async function runWriterAgent(
  ctx: PlanningContext,
): Promise<AgentStepResult<WriterOutput>> {
  const { input, duration, aspectRatio } = ctx;
  const { output, reasoning } = await runAgentStep<WriterOutput>(
    "writer",
    `你是 AI 短剧专职编剧。
规则：
1. 根据用户梗概写 title、logline、三幕 acts、旁白 narratorLines。
2. 定义 1-3 个 scenes（id 稳定如 scene_1），含 location/atmosphere/promptAnchor。
3. 输出 8-15 个分镜骨架 shots：仅 id/order/sceneId/characterIds/dialogue，不写画面描述。
4. characterIds 使用 char_1、char_2 等占位，后续角色 Agent 会对齐。
5. 总时长约 ${duration} 秒。画幅 ${aspectRatio}。
6. 只输出 JSON。`,
    `用户想法：${input.userIdea}\n目标时长：${duration}秒\n画幅：${aspectRatio}${refineGuidance(ctx)}`,
    WRITER_JSON_SCHEMA,
  );
  return { output, reasoning };
}
