import { DRAMA_SKILL_ID } from "@/components/creation-dock-controls";
import type { CreationMode } from "@aimarket/ui";
import type { CreationLane } from "./creation-dock-prefs";

const DRAMA_INTENT_PATTERN =
  /(?:短剧|剧情|剧本|分镜|drama|script|storyboard)/i;

export function isDramaIntentPrompt(prompt: string): boolean {
  return DRAMA_INTENT_PATTERN.test(prompt.trim());
}

export interface DramaOrchestrationContext {
  creationLane: CreationLane;
  activeSkillId: string | null;
  prompt: string;
  effectiveMode?: CreationMode;
  hasDramaSessionState?: boolean;
}

/** Agent 车道下是否走短剧编排（无需 UI 选择技能） */
export function shouldUseDramaOrchestration(
  ctx: DramaOrchestrationContext,
): boolean {
  if (ctx.activeSkillId === DRAMA_SKILL_ID) return true;
  if (ctx.hasDramaSessionState) return true;
  if (ctx.effectiveMode === "production") return true;
  if (ctx.creationLane === "agent" && isDramaIntentPrompt(ctx.prompt)) {
    return true;
  }
  return false;
}
