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
}

export interface ExecuteStepResult {
  jobId: string;
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
}
