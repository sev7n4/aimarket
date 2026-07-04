import { runAgentStep } from "../reasoning.js";
import { refineGuidance } from "../refine.js";
import { STORYBOARD_JSON_SCHEMA } from "../schemas.js";
import type { AgentStepResult, PlanningContext, StoryboardOutput } from "../types.js";

export async function runStoryboardAgent(
  ctx: PlanningContext,
): Promise<AgentStepResult<StoryboardOutput>> {
  const writer = ctx.writer!;
  const director = ctx.director!;
  const character = ctx.character!;
  const cinematographer = ctx.cinematographer!;
  const camById = Object.fromEntries(
    cinematographer.shots.map((s) => [s.id, s]),
  );
  const enrichedShots = writer.shots.map((s) => {
    const cam = camById[s.id];
    return {
      id: s.id,
      order: s.order,
      sceneId: s.sceneId,
      characterIds: s.characterIds,
      dialogue: s.dialogue,
      motionPrompt: cam?.motionPrompt ?? "",
      cameraSpec: cam?.cameraSpec,
    };
  });
  const { output, reasoning } = await runAgentStep<StoryboardOutput>(
    "storyboard",
    `你是 AI 短剧分镜师。
规则：
1. 完善每个镜头的 visualPrompt（画面描述具体可生成）、durationSec（3-8秒）、useLastFrameContinuity。
2. 保留所有 shot id/order/sceneId/characterIds/dialogue，可 refine motionPrompt/cameraSpec。
3. 同场景连续镜头 useLastFrameContinuity=true（尾帧衔接）。
4. 总时长约 ${ctx.duration} 秒，8-15 镜。
5. 只输出 JSON。`,
    `标题：${writer.title}\n角色：${character.characters.map((c) => c.name).join("、")}\n风格：${JSON.stringify(director.styleBible)}\n镜头草稿：${JSON.stringify(enrichedShots)}${refineGuidance(ctx)}`,
    STORYBOARD_JSON_SCHEMA,
  );
  return { output, reasoning };
}
