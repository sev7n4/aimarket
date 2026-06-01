import type { AgentPlan } from "../plan/schema.js";

export interface JobObservation {
  jobId: string;
  status: "succeeded" | "failed";
  outputIds: string[];
  urls: string[];
  error?: string;
  pointsCost?: number;
  provider?: string;
}

export type AgentRunStatus =
  | "planning"
  | "waiting_confirm"
  | "running"
  | "waiting_job"
  | "completed"
  | "failed"
  | "cancelled";

export interface AgentSessionState {
  runId: string;
  sessionId: string;
  userId: string;
  prompt: string;
  mode: string;
  confirmed: boolean;
  plan: AgentPlan | null;
  currentStepIndex: number;
  pendingJobId: string | null;
  observations: JobObservation[];
  status: AgentRunStatus;
  error?: string;
  stepRetries?: Record<number, number>;
  observeDecision?: ObserveStepDecision | null;
}

export interface ExecuteStepResult {
  jobId: string;
}

export type ObserveStepDecision = "advance" | "retry" | "fail";

export interface ObserveStepResult {
  decision: ObserveStepDecision;
  heroOutputIndex?: number;
  note?: string;
}

export interface SessionGraphDeps {
  resolvePlan: (input: {
    prompt: string;
    mode: string;
  }) => Promise<AgentPlan>;
  executeStep: (
    state: AgentSessionState,
    stepIndex: number,
  ) => Promise<ExecuteStepResult>;
  /** P3：Job 产出 VLM 质检，可触发同一步重试 */
  observeStep?: (
    state: AgentSessionState,
    observation: JobObservation,
  ) => Promise<ObserveStepResult>;
  maxStepRetries?: number;
}
