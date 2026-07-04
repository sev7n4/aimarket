import type { PlanningContext } from "./types.js";

/**
 * 多轮对话迭代提示词片段。
 *
 * 当本次规划为「基于既有方案的改写」（存在 refineInstruction + basePlan）时，
 * 追加到各 Agent 的 userPrompt 末尾，指导模型：
 * 1. 在既有方案基础上按用户指令调整，而非从零重写。
 * 2. 保留稳定 id（char_、scene_、shot_ 前缀），未被指令涉及的内容尽量保留。
 *
 * 返回空字符串表示非迭代场景，调用方可直接拼接。
 */
export function refineGuidance(ctx: PlanningContext): string {
  const instruction = ctx.refineInstruction ?? ctx.input.refineInstruction;
  const base = ctx.basePlan;
  if (!instruction || !base) return "";

  const overview = {
    title: base.script.title,
    logline: base.script.logline,
    characters: base.characters.map((c) => ({ id: c.id, name: c.name })),
    scenes: base.scenes.map((s) => ({ id: s.id, name: s.name })),
    shots: base.shots.map((s) => ({
      id: s.id,
      order: s.order,
      sceneId: s.sceneId,
      characterIds: s.characterIds,
    })),
  };

  return `\n\n【多轮迭代 · 基于既有方案改写】
本次为对既有方案的迭代，请按用户修改指令在既有方案基础上调整，而非从零重写。
用户修改指令：${instruction}
要求：
1. 保留稳定 id（char_*/scene_*/shot_*），新增内容再分配新 id。
2. 未被指令涉及的内容尽量保留，被指令涉及的部分按指令改写并可扩充。
既有方案概览（供参考）：
${JSON.stringify(overview)}`;
}
