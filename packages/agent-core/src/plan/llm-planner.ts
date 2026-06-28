import { completeWithFallback } from "../llm/router.js";
import type { OrchestratorMessage } from "../llm/types.js";
import {
  agentPlanSchema,
  llmPlanDraftSchema,
  type AgentPlan,
  type LlmPlanDraft,
} from "./schema.js";

export interface PublicToolMeta {
  id: string;
  name: string;
  description: string;
}

export interface LlmPlannerInput {
  prompt: string;
  mode: string;
  tools: PublicToolMeta[];
}

const LLM_PLAN_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["intent", "steps"],
  properties: {
    intent: { type: "string" },
    skillId: { type: "string" },
    reason: { type: "string" },
    requiresConfirm: { type: "boolean" },
    steps: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "label"],
        properties: {
          type: { type: "string", enum: ["generate", "tool", "video"] },
          toolId: { type: "string" },
          label: { type: "string" },
          prompt: { type: "string" },
          args: { type: "object" },
        },
      },
    },
  },
};

function buildSystemPrompt(tools: PublicToolMeta[]): string {
  const toolLines = tools
    .map((t) => `- ${t.id}: ${t.name} — ${t.description}`)
    .join("\n");
  const canvasTools = tools.filter((t) => t.id.startsWith("canvas_"));
  const hasCanvasTools = canvasTools.length > 0;
  const canvasGuide = hasCanvasTools
    ? `\n7. canvas_* 工具用于在节点画布上创建/连接/更新/删除节点。使用时在 step.args 中传结构化参数：
   - canvas_create_node: args={type:"script"|"image"|"video"|"audio"|"text", position:{x:number,y:number}, label:"标签", prompt:"关联提示词"}
   - canvas_connect_nodes: args={sourceNodeId:"id", targetNodeId:"id"}
   - canvas_update_node: args={nodeId:"id", label:"新标签"}
   - canvas_delete_node: args={nodeId:"id"}
   position 坐标用画布坐标系（右为正x，下为正y），建议节点间距 300px 水平、200px 垂直。`
    : "";
  return `你是出图宝（电商 AI 创作）的编排 Agent。根据用户中文意图输出 JSON 执行计划。

规则：
1. steps 按执行顺序排列；type 为 generate（文生图/图生图）、tool（精修工具）、video（宣传片，P2 可规划但可能尚未执行）。
2. tool 步骤的 toolId 必须从下列工具 id 中选择，禁止编造：
${toolLines}
3. 电商套图/主图/详情/上架等意图：优先多步 generate，不要单步应付。
4. 仅抠图/扩图/消除等：用 tool 步骤。
5. 不确定时 requiresConfirm 设为 true。
6. 只输出 JSON，不要 markdown。${canvasGuide}`;
}

export async function buildLlmPlanDraft(
  input: LlmPlannerInput,
): Promise<LlmPlanDraft> {
  const messages: OrchestratorMessage[] = [
    { role: "system", content: buildSystemPrompt(input.tools) },
    {
      role: "user",
      content: `mode=${input.mode}\n用户请求：${input.prompt}`,
    },
  ];

  const result = await completeWithFallback({
    messages,
    jsonSchema: LLM_PLAN_JSON_SCHEMA,
    temperature: 0.2,
    maxTokens: 2048,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.content);
  } catch {
    throw new Error("LLM_PLAN_JSON_PARSE_FAILED");
  }

  return llmPlanDraftSchema.parse(parsed);
}

export function mergeLlmDraftIntoPlan(
  draft: LlmPlanDraft,
  enriched: Omit<AgentPlan, "planSource">,
): AgentPlan {
  const plan = agentPlanSchema.parse({
    ...enriched,
    intent: draft.intent || enriched.intent,
    steps: draft.steps.map((s) => ({
      ...s,
      prompt: s.prompt ?? (s.type === "generate" ? draft.intent : undefined),
    })),
    reason: draft.reason ?? enriched.reason,
    requiresConfirm:
      draft.requiresConfirm ?? enriched.requiresConfirm,
    skillId: draft.skillId,
    planSource: "llm",
  });
  return plan;
}
