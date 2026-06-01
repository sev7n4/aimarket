import type {
  AgentSessionState,
  JobObservation,
  ObserveStepResult,
} from "@aimarket/agent-core";
import {
  isAgentVlmEnabled,
  runVlmQualityCheck,
} from "../../providers/vlm/registry.js";

export async function observeAgentStep(
  state: AgentSessionState,
  observation: JobObservation,
): Promise<ObserveStepResult> {
  if (!isAgentVlmEnabled()) {
    return { decision: "advance" };
  }
  if (observation.status !== "succeeded" || observation.urls.length === 0) {
    return { decision: "advance" };
  }

  const qc = await runVlmQualityCheck({
    prompt: state.prompt,
    urls: observation.urls,
    mode: state.mode,
  });

  const maxRetries = Number(process.env.AGENT_VLM_MAX_STEP_RETRIES ?? "1");
  const used = state.stepRetries?.[state.currentStepIndex] ?? 0;

  if (!qc.pass) {
    if (used < maxRetries) {
      return { decision: "retry", note: qc.reason ?? "质检未通过，重试本步" };
    }
    return {
      decision: "fail",
      note: qc.reason ?? "质检未通过（已达重试上限）",
    };
  }

  return {
    decision: "advance",
    heroOutputIndex: qc.heroIndex,
    note: qc.reason,
  };
}
