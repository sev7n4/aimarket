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
1. 根据用户梗概写 title、logline、acts（幕数由故事与 ${duration}s 时长推理，通常 2–5 幕，禁止机械固定 3 幕）、旁白 narratorLines。
2. 定义 scenes（数量与 acts/场次匹配，通常 1–4 个；id 稳定如 scene_1），含 location/atmosphere/promptAnchor。
3. 输出 8-15 个分镜骨架 shots：仅 id/order/sceneId/characterIds/dialogue，不写画面描述。
4. characterIds 使用 char_1、char_2 等占位，后续角色 Agent 会对齐。
5. 总时长约 ${duration} 秒。画幅 ${aspectRatio}。
6. 只输出 JSON。`,
    `用户想法：${input.userIdea}\n目标时长：${duration}秒\n画幅：${aspectRatio}${refineGuidance(ctx)}`,
    WRITER_JSON_SCHEMA,
  );
  return { output, reasoning };
}
