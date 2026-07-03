/**
 * Canvas Agent 在线函数调用循环
 * 对接 aimarket 的 /api/agent/tool-response 端点
 */

import type {
  OrchestratorMessage,
  OrchestratorToolCall,
  OrchestratorToolChoice,
  OrchestratorToolDefinition,
} from "./types";
import type { CanvasAgentOp, CanvasAgentSnapshot } from "../utils";
import { describeSnapshotForAgent, onlineToolToOps } from "./agent-tools";

export const CANVAS_AGENT_SYSTEM_PROMPT = `你是 AIMarket 画布助手。当前画布 JSON 会随用户消息提供。

首轮必须调用工具：
- 只读问题调用 canvas_get_state / canvas_get_selection / canvas_export_snapshot
- 需要改动画布时调用 canvas_apply_ops（支持 add_node / update_node / delete_node / connect_nodes / set_viewport / select_nodes / run_generation）
- 需要生成内容时调用 canvas_generate_image / canvas_generate_video
- Drama 创作时调用 drama_create_script / drama_create_character / drama_create_shot / drama_create_scene

工具参数涉及已有节点时必须使用画布 JSON 中真实存在的 id。
缺少必要 id 或用户意图不明确时直接说明需要用户明确选择或说明，不要猜测。
工具返回结果后，再根据真实结果回答用户。`;

const MAX_AGENT_STEPS = 6;

export type ToolCallResult = {
  toolCallId: string;
  name: string;
  ok: boolean;
  message: string;
  data?: {
    ops?: CanvasAgentOp[];
    nodes?: CanvasAgentSnapshot["nodes"];
    [key: string]: unknown;
  };
};

export type AgentLoopCallbacks = {
  onAssistantMessage: (text: string) => void;
  onToolCallPending: (toolCalls: OrchestratorToolCall[], step: number) => void;
  onToolCallApproved: (results: ToolCallResult[], step: number) => void;
  onToolCallRejected: (step: number) => void;
  onMaxStepsReached: () => void;
  onError: (error: string) => void;
  onComplete: (finalText: string) => void;
};

async function callToolResponse(
  messages: OrchestratorMessage[],
  tools: OrchestratorToolDefinition[],
  toolChoice: OrchestratorToolChoice,
): Promise<{ content: string; toolCalls: OrchestratorToolCall[]; providerId: string }> {
  const res = await fetch("/api/v1/agent/tool-response", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages,
      tools,
      toolChoice,
      maxTokens: 4096,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`工具响应失败 ${res.status}: ${text}`);
  }

  const json = await res.json() as { data: { content: string; toolCalls: OrchestratorToolCall[]; providerId: string } };
  return json.data;
}

function buildSystemMessage(snapshot: CanvasAgentSnapshot): OrchestratorMessage {
  const snapshotText = describeSnapshotForAgent(snapshot);
  return {
    role: "system",
    content: `${CANVAS_AGENT_SYSTEM_PROMPT}\n\n当前画布状态：\n${snapshotText}`,
  };
}

function parseToolArguments(args: string): Record<string, unknown> {
  try {
    return JSON.parse(args);
  } catch {
    return {};
  }
}

/**
 * 执行工具调用（本地执行 + 构造结果）
 */
export function executeToolCallsLocally(
  toolCalls: OrchestratorToolCall[],
  snapshot: CanvasAgentSnapshot,
): ToolCallResult[] {
  return toolCalls.map((tc) => {
    try {
      const args = parseToolArguments(
        typeof tc.arguments === "string" ? tc.arguments : JSON.stringify(tc.arguments),
      );
      const ops = onlineToolToOps(tc.name, args, snapshot);

      if (ops.length === 0) {
        return {
          toolCallId: tc.id,
          name: tc.name,
          ok: true,
          message: `工具 ${tc.name} 执行完成（无画布变更）`,
        };
      }

      return {
        toolCallId: tc.id,
        name: tc.name,
        ok: true,
        message: ops
          .map((op) => {
            if (op.type === "add_node") return `已创建 ${op.nodeType} 节点: "${op.title}"`;
            if (op.type === "update_node") return `已更新节点 ${op.id}`;
            if (op.type === "delete_node") return `已删除 ${(op.ids ?? []).length} 个节点`;
            if (op.type === "connect_nodes") return `已连接节点`;
            if (op.type === "set_viewport") return `已调整视口`;
            if (op.type === "select_nodes") return `已选中 ${(op.ids ?? []).length} 个节点`;
            if (op.type === "run_generation") return `已触发节点 ${op.nodeId} 生成`;
            if (op.type === "plan_drama") return `已提交短剧规划: "${op.idea.slice(0, 40)}"`;
            if (op.type === "run_drama_production") return `已触发 Drama 制作流水线`;
            if (op.type === "generate_character_sheet") return `已请求生成角色三视图 ${op.characterNodeId}`;
            if (op.type === "generate_shot_image") return `已请求生成分镜图 ${op.shotNodeId}`;
            if (op.type === "generate_shot_video") return `已请求生成分镜视频 ${op.shotNodeId}`;
            if (op.type === "update_shot_status") return `已更新分镜状态: ${op.status}`;
            if (op.type === "update_character_ref") return `已更新角色参考`;
            if (op.type === "update_scene_ref") return `已更新场景参考`;
            if (op.type === "focus_drama_node") return `已聚焦节点`;
            return `${op.type} 执行完成`;
          })
          .join("; "),
        data: { ops },
      };
    } catch (err) {
      return {
        toolCallId: tc.id,
        name: tc.name,
        ok: false,
        message: err instanceof Error ? err.message : "工具执行失败",
      };
    }
  });
}

/**
 * 主入口：运行 Agent 函数调用循环
 *
 * @param snapshot 当前画布快照（引用，可被外部更新）
 * @param userMessage 用户输入的消息文本
 * @param historyMessages 之前的对话历史
 * @param tools 可用的工具列表
 * @param onApplyOps 当需要执行画布操作时的回调，返回更新后的快照
 * @param confirmTools 是否需要用户确认写操作
 * @param callbacks 各种事件的回调
 */
export async function runCanvasAgentLoop({
  snapshot,
  userMessage,
  historyMessages,
  tools,
  onApplyOps,
  confirmTools = false,
  callbacks,
}: {
  snapshot: CanvasAgentSnapshot;
  userMessage: string;
  historyMessages: OrchestratorMessage[];
  tools: OrchestratorToolDefinition[];
  onApplyOps: (ops: CanvasAgentOp[]) => CanvasAgentSnapshot;
  confirmTools?: boolean;
  callbacks: AgentLoopCallbacks;
}): Promise<void> {
  const messages: OrchestratorMessage[] = [
    buildSystemMessage(snapshot),
    ...historyMessages,
    { role: "user", content: userMessage },
  ];

  let step = 1;
  let currentSnapshot = snapshot;
  let isFirstStep = true;

  while (step <= MAX_AGENT_STEPS) {
    try {
      const toolChoice: OrchestratorToolChoice = isFirstStep ? "required" : "auto";
      const result = await callToolResponse(messages, tools, toolChoice);

      if (result.toolCalls.length === 0) {
        // 没有工具调用，直接返回文字回复
        callbacks.onAssistantMessage(result.content || "没有回复内容");
        callbacks.onComplete(result.content || "");
        return;
      }

      // 构造 assistant 消息
      const assistantMsg: OrchestratorMessage = {
        role: "assistant",
        content: result.content || "",
      };
      messages.push(assistantMsg);

      const writableCalls = result.toolCalls.filter(
        (tc) => !["canvas_get_state", "canvas_get_selection", "canvas_export_snapshot"].includes(tc.name),
      );

      if (confirmTools && writableCalls.length > 0 && !isFirstStep) {
        // 需要用户确认
        callbacks.onAssistantMessage(result.content || "准备执行操作，等待确认…");
        callbacks.onToolCallPending(result.toolCalls, step);
        // 暂停 — 等待用户 approve/reject
        // 注意：这里需要调用方在 approve 时调用 continueWithApprovedResults
        return; // 暂停循环，等待外部 approve
      }

      // 自动执行工具
      const results = executeToolCallsLocally(result.toolCalls, currentSnapshot);

      // 将工具结果加入消息
      for (const tc of result.toolCalls) {
        const r = results.find((x) => x.toolCallId === tc.id);
        messages.push({
          role: "tool",
          content: JSON.stringify(r ?? { ok: false, message: "unknown tool" }),
        });
      }

      callbacks.onToolCallApproved(results, step);

      // 将 ops 应用到画布
      const allOps = results
        .filter((r) => r.ok && r.data?.ops)
        .flatMap((r) => (r.data?.ops as CanvasAgentOp[]) ?? []);
      if (allOps.length > 0) {
        currentSnapshot = onApplyOps(allOps);
      }

      isFirstStep = false;
      step++;
    } catch (err) {
      callbacks.onError(err instanceof Error ? err.message : "Agent 执行出错");
      return;
    }
  }

  // 达到最大步数
  callbacks.onMaxStepsReached();
}

/**
 * 用户批准后继续循环
 */
export async function continueAgentLoopAfterApproval({
  approvedToolCalls,
  snapshot,
  messages,
  tools,
  step,
  onApplyOps,
  callbacks,
}: {
  approvedToolCalls: OrchestratorToolCall[];
  snapshot: CanvasAgentSnapshot;
  messages: OrchestratorMessage[];
  tools: OrchestratorToolDefinition[];
  step: number;
  onApplyOps: (ops: CanvasAgentOp[]) => CanvasAgentSnapshot;
  callbacks: AgentLoopCallbacks;
}): Promise<void> {
  const results = executeToolCallsLocally(approvedToolCalls, snapshot);

  for (const tc of approvedToolCalls) {
    const r = results.find((x) => x.toolCallId === tc.id);
    messages.push({
      role: "tool",
      content: JSON.stringify(r ?? { ok: false, message: "unknown tool" }),
    });
  }

  callbacks.onToolCallApproved(results, step);

  const allOps = results
    .filter((r) => r.ok && r.data?.ops)
    .flatMap((r) => (r.data?.ops as CanvasAgentOp[]) ?? []);
  let currentSnapshot = snapshot;
  if (allOps.length > 0) {
    currentSnapshot = onApplyOps(allOps);
  }

  // 继续下一轮
  let nextStep = step + 1;
  const isFirstStep = false;

  while (nextStep <= MAX_AGENT_STEPS) {
    try {
      const result = await callToolResponse(messages, tools, "auto");

      if (result.toolCalls.length === 0) {
        callbacks.onAssistantMessage(result.content || "操作完成");
        callbacks.onComplete(result.content || "");
        return;
      }

      const assistantMsg: OrchestratorMessage = { role: "assistant", content: result.content || "" };
      messages.push(assistantMsg);

      const writableCalls = result.toolCalls.filter(
        (tc) => !["canvas_get_state", "canvas_get_selection", "canvas_export_snapshot"].includes(tc.name),
      );

      if (writableCalls.length > 0) {
        callbacks.onAssistantMessage(result.content || "准备执行操作，等待确认…");
        callbacks.onToolCallPending(result.toolCalls, nextStep);
        return; // 等待下一轮批准
      }

      const nextResults = executeToolCallsLocally(result.toolCalls, currentSnapshot);

      for (const tc of result.toolCalls) {
        const r = nextResults.find((x) => x.toolCallId === tc.id);
        messages.push({
          role: "tool",
          content: JSON.stringify(r ?? { ok: false, message: "unknown tool" }),
        });
      }

      callbacks.onToolCallApproved(nextResults, nextStep);

      const nextOps = nextResults
        .filter((r) => r.ok && r.data?.ops)
        .flatMap((r) => (r.data?.ops as CanvasAgentOp[]) ?? []);
      if (nextOps.length > 0) {
        currentSnapshot = onApplyOps(nextOps);
      }

      nextStep++;
    } catch (err) {
      callbacks.onError(err instanceof Error ? err.message : "Agent 执行出错");
      return;
    }
  }

  callbacks.onMaxStepsReached();
}
