import {
  buildLlmPlanDraft,
  isAgentLlmEnabled,
  mergeLlmDraftIntoPlan,
  type AgentPlan,
  type PlanStep,
  type PublicToolMeta,
} from "@aimarket/agent-core";
import { ECOMMERCE_SLIDES } from "../ecommerce.js";
import { buildAgentPlan } from "../planner.js";
import { estimatePoints, estimateToolPoints } from "../pricing.js";
import { suggestModel } from "../router.js";
import { listToolsPublic } from "../tools.js";

const CONFIRM_POINTS_THRESHOLD = 40;

export interface ResolvePlanInput {
  prompt: string;
  mode: string;
  modelId?: string;
  resolution?: string;
  aspectRatio?: string;
  count?: number;
  /** 画布选中的输出 ID（用于图生视频/编辑等） */
  selectedOutputId?: string;
  /** 当前是否有 mask（触发 inpaint 步骤） */
  hasMasks?: boolean;
  /** 当前是否有焦点编辑点 */
  hasFocusPoints?: boolean;
  /** 检测到的物体类别 */
  objectCategory?: string;
  /** 上一步使用的工具 ID */
  lastToolId?: string;
  /** 参考图 URL 列表 */
  referenceUrls?: string[];
}

/** 视频相关关键词 */
const VIDEO_KEYWORDS = ["视频", "动效", "动画", "运动", "video", "animate", "motion"];

/** 判断 prompt 是否包含视频关键词 */
function promptHasVideoKeywords(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return VIDEO_KEYWORDS.some((k) => lower.includes(k));
}

/** 根据画布上下文推断应追加的步骤 */
function inferCanvasAwareSteps(input: ResolvePlanInput): PlanStep[] {
  // 有 mask → inpaint
  if (input.hasMasks) {
    return [{ type: "tool", toolId: "inpaint", label: "局部重绘" }];
  }
  // 有焦点编辑点 + 文字类别 → text 工具
  if (input.hasFocusPoints && input.objectCategory === "text") {
    return [{ type: "tool", toolId: "text", label: "文字编辑" }];
  }
  // 有焦点编辑点 → inpaint
  if (input.hasFocusPoints) {
    return [{ type: "tool", toolId: "inpaint", label: "局部重绘" }];
  }
  // 选中输出 + prompt 含视频关键词 → 视频步骤
  if (input.selectedOutputId && promptHasVideoKeywords(input.prompt)) {
    return [{ type: "tool", toolId: "video", label: "生成视频" }];
  }
  return [];
}

/** 根据画布上下文增强 Plan 步骤 */
function enrichPlanWithCanvasContext(
  plan: ReturnType<typeof buildAgentPlan>,
  input: ResolvePlanInput,
): ReturnType<typeof buildAgentPlan> {
  const steps = [...plan.steps];

  // 规则 1：有 mask/焦点编辑点，且 plan 中没有 tool 步骤，在前面插入画布感知步骤
  const canvasSteps = inferCanvasAwareSteps(input);
  if (canvasSteps.length > 0 && !steps.some((s) => s.type === "tool")) {
    steps.unshift(...canvasSteps);
  }

  // 规则 2：selectedOutputId 存在时，给 generate 步骤设置 sourceOutputId
  if (input.selectedOutputId) {
    for (let i = 0; i < steps.length; i++) {
      if (steps[i].type === "generate") {
        // sourceOutputId 为画布感知扩展属性，通过类型断言携带至最终输出
        steps[i] = { ...steps[i], sourceOutputId: input.selectedOutputId } as typeof steps[number];
      }
    }
  }

  // 规则 3：objectCategory === "text" 时，优先用 text 工具替代 inpaint
  if (input.objectCategory === "text") {
    for (let i = 0; i < steps.length; i++) {
      if (steps[i].type === "tool" && steps[i].toolId === "inpaint") {
        steps[i] = { ...steps[i], toolId: "text", label: "文字编辑" };
      }
    }
  }

  // 规则 4：referenceUrls 非空 + prompt 含视频关键词，在末尾追加视频步骤
  if (
    input.referenceUrls?.length &&
    promptHasVideoKeywords(input.prompt) &&
    !steps.some((s) => s.type === "tool" && s.toolId === "video")
  ) {
    steps.push({ type: "tool", toolId: "video", label: "生成视频" });
  }

  // 如果追加了视频步骤，mode 需要支持视频生成
  const mode = steps.some((s) => s.type === "tool" && s.toolId === "video")
    ? "chat"
    : plan.mode;

  return { ...plan, steps, mode };
}

function enrichPlan(
  base: ReturnType<typeof buildAgentPlan>,
  planSource: "llm" | "rule",
  draftSteps?: AgentPlan["steps"],
): AgentPlan {
  const steps = draftSteps ?? base.steps;
  const route = suggestModel(base.mode, base.intent);
  let estimatedPoints = 0;
  for (const step of steps) {
    if (step.type === "tool" && step.toolId) {
      estimatedPoints += estimateToolPoints(step.toolId, base.resolution, 1);
    } else if (step.type === "generate") {
      estimatedPoints += estimatePoints(base.modelId, 1, base.resolution);
    }
  }

  const requiresConfirm =
    estimatedPoints >= CONFIRM_POINTS_THRESHOLD ||
    steps.length > 1 ||
    base.count > 1;

  return {
    ...base,
    steps,
    estimatedPoints,
    requiresConfirm,
    reason: base.reason || route.reason,
    planSource,
  };
}

export async function resolveAgentPlan(
  input: ResolvePlanInput,
): Promise<AgentPlan> {
  const rulePlan = enrichPlanWithCanvasContext(buildAgentPlan(input), input);

  if (!isAgentLlmEnabled()) {
    return enrichPlan(rulePlan, "rule");
  }

  const tools: PublicToolMeta[] = listToolsPublic().map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
  }));

  try {
    const draft = await buildLlmPlanDraft({
      prompt: input.prompt,
      mode: input.mode,
      tools,
    });

    const ecommerce =
      input.mode === "ecommerce" ||
      draft.steps.every((s: PlanStep) => s.type === "generate");
    const count =
      input.count ??
      (ecommerce ? ECOMMERCE_SLIDES.length : draft.steps.length || 1);

    const merged = mergeLlmDraftIntoPlan(draft, {
      intent: draft.intent || input.prompt.trim(),
      modelId: input.modelId ?? rulePlan.modelId,
      mode: rulePlan.mode,
      resolution: input.resolution ?? rulePlan.resolution,
      aspectRatio: input.aspectRatio ?? rulePlan.aspectRatio,
      count,
      steps: draft.steps,
      estimatedPoints: rulePlan.estimatedPoints,
      requiresConfirm: rulePlan.requiresConfirm,
      reason: draft.reason ?? rulePlan.reason,
      skillId: draft.skillId,
    });

    const llmPlan = enrichPlanWithCanvasContext(
      { ...rulePlan, ...merged, steps: merged.steps },
      input,
    );
    return enrichPlan(llmPlan, "llm", merged.steps);
  } catch (err) {
    console.warn("[agent] LLM plan failed, using rule planner:", err);
    return enrichPlan(rulePlan, "rule");
  }
}
