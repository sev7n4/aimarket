import { MemorySaver } from "@langchain/langgraph";
import { END, START, StateGraph, interrupt } from "@langchain/langgraph";
import { Annotation } from "@langchain/langgraph";
import type { AgentPlan } from "../plan/schema.js";
import type {
  AgentRunStatus,
  AgentSessionState,
  JobObservation,
  SessionGraphDeps,
} from "./types.js";

const AgentStateAnnotation = Annotation.Root({
  runId: Annotation<string>,
  sessionId: Annotation<string>,
  userId: Annotation<string>,
  prompt: Annotation<string>,
  mode: Annotation<string>,
  confirmed: Annotation<boolean>,
  plan: Annotation<AgentPlan | null>,
  currentStepIndex: Annotation<number>,
  pendingJobId: Annotation<string | null>,
  observations: Annotation<JobObservation[]>,
  status: Annotation<AgentRunStatus>,
  error: Annotation<string | undefined>,
  stepRetries: Annotation<Record<number, number>>({
    reducer: (left, right) => ({ ...left, ...right }),
    default: () => ({}),
  }),
  observeDecision: Annotation<
    import("./types.js").ObserveStepDecision | null
  >,
});

type GraphState = typeof AgentStateAnnotation.State;

/** 可选注入 SqliteSaver 等（由 apps/api 传入，避免 checkpoint 包版本与 agent-core 绑定） */
export function createSessionGraph(
  deps: SessionGraphDeps,
  checkpointer: unknown = new MemorySaver(),
) {
  const graph = new StateGraph(AgentStateAnnotation)
    .addNode("plan_step", async (state: GraphState) => {
      const plan = await deps.resolvePlan({
        prompt: state.prompt,
        mode: state.mode,
      });
      return {
        plan,
        status: "running" as const,
        currentStepIndex: 0,
      };
    })
    .addNode("confirm_gate", async (state: GraphState) => {
      if (state.plan?.requiresConfirm && !state.confirmed) {
        return { status: "waiting_confirm" as const };
      }
      return {};
    })
    .addNode("execute_step", async (state: GraphState) => {
      if (!state.plan) {
        return { status: "failed" as const, error: "缺少执行计划" };
      }
      if (state.currentStepIndex >= state.plan.steps.length) {
        return { status: "completed" as const, pendingJobId: null };
      }
      const step = state.plan.steps[state.currentStepIndex];
      if (step.type === "video") {
        return {
          status: "failed" as const,
          error: "视频步骤尚未在 P1 实现，请使用 P2 Skill",
        };
      }
      try {
        const { jobId } = await deps.executeStep(
          state as AgentSessionState,
          state.currentStepIndex,
        );
        return {
          pendingJobId: jobId,
          status: "waiting_job" as const,
          observeDecision: null,
        };
      } catch (err) {
        return {
          status: "failed" as const,
          error: err instanceof Error ? err.message : "执行步骤失败",
        };
      }
    })
    .addNode("wait_job", async (state: GraphState) => {
      if (!state.pendingJobId) {
        return {};
      }
      const observation = interrupt({
        kind: "job",
        jobId: state.pendingJobId,
      }) as JobObservation;
      return {
        observations: [...state.observations, observation],
        pendingJobId: null,
      };
    })
    .addNode("observe", async (state: GraphState) => {
      const last = state.observations[state.observations.length - 1];
      if (!last || last.status === "failed") {
        return {
          status: "failed" as const,
          error: last?.error ?? "Job 失败",
          observeDecision: null,
        };
      }

      if (!deps.observeStep) {
        return { status: "running" as const, observeDecision: "advance" as const };
      }

      const result = await deps.observeStep(state as AgentSessionState, last);
      if (result.decision === "fail") {
        return {
          status: "failed" as const,
          error: result.note ?? "质检未通过",
          observeDecision: null,
        };
      }

      if (result.decision === "retry") {
        const used = state.stepRetries[state.currentStepIndex] ?? 0;
        const max = deps.maxStepRetries ?? 1;
        if (used < max) {
          return {
            status: "running" as const,
            observeDecision: "retry" as const,
            stepRetries: {
              [state.currentStepIndex]: used + 1,
            },
          };
        }
        return {
          status: "failed" as const,
          error: result.note ?? "质检未通过（已达重试上限）",
          observeDecision: null,
        };
      }

      return {
        status: "running" as const,
        observeDecision: "advance" as const,
      };
    })
    .addNode("advance", async (state: GraphState) => {
      const nextIndex = state.currentStepIndex + 1;
      if (!state.plan || nextIndex >= state.plan.steps.length) {
        return {
          currentStepIndex: nextIndex,
          status: "completed" as const,
        };
      }
      return {
        currentStepIndex: nextIndex,
        status: "running" as const,
      };
    })
    .addEdge(START, "plan_step")
    .addEdge("plan_step", "confirm_gate")
    .addConditionalEdges("confirm_gate", (state: GraphState) => {
      if (state.status === "waiting_confirm") return END;
      return "execute_step";
    })
    .addConditionalEdges("execute_step", (state: GraphState) => {
      if (state.status === "failed" || state.status === "completed") return END;
      if (state.pendingJobId) return "wait_job";
      return END;
    })
    .addEdge("wait_job", "observe")
    .addConditionalEdges("observe", (state: GraphState) => {
      if (state.status === "failed") return END;
      if (state.observeDecision === "retry") return "execute_step";
      return "advance";
    })
    .addConditionalEdges("advance", (state: GraphState) => {
      if (state.status === "completed") return END;
      return "execute_step";
    });

  return graph.compile({
    checkpointer: checkpointer as MemorySaver,
  });
}
