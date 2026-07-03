import { loadSkill, type SkillStep } from "@aimarket/agent-skills";
import {
  resolveDramaPipelineSteps,
  type DramaPipelineStep,
} from "./schema.js";
import type { DramaProjectRow } from "./projects.js";
import type { DramaRunRow } from "./runs.js";

export type DramaRunGraphNodeStatus =
  | "pending"
  | "running"
  | "done"
  | "failed";

export interface DramaRunGraphNode {
  id: DramaPipelineStep;
  stepId: string;
  label: string;
  type: string;
  status: DramaRunGraphNodeStatus;
  index: number;
}

export interface DramaRunGraphEdge {
  id: string;
  source: DramaPipelineStep;
  target: DramaPipelineStep;
}

export interface DramaRunGraph {
  runId: string;
  skillId: string;
  nodes: DramaRunGraphNode[];
  edges: DramaRunGraphEdge[];
}

const SKILL_STEP_TO_PIPELINE: Record<string, DramaPipelineStep> = {
  bgm: "bgm",
  final_edit: "concat",
};

function toPipelineStepId(
  skillStepId: string,
  skillId: string,
): DramaPipelineStep | null {
  const mapped = SKILL_STEP_TO_PIPELINE[skillStepId];
  if (mapped) return mapped;
  const steps = resolveDramaPipelineSteps(skillId);
  if ((steps as readonly string[]).includes(skillStepId)) {
    return skillStepId as DramaPipelineStep;
  }
  return null;
}

function skillStepDeps(step: SkillStep): string[] {
  if ("sourceSteps" in step && step.sourceSteps?.length) {
    return step.sourceSteps;
  }
  if ("sourceStep" in step && step.sourceStep) {
    return [step.sourceStep];
  }
  return [];
}

function nodeStatus(
  stepIndex: number,
  currentStepIndex: number,
  runStatus: string,
): DramaRunGraphNodeStatus {
  if (runStatus === "failed") {
    if (stepIndex < currentStepIndex) return "done";
    if (stepIndex === currentStepIndex) return "failed";
    return "pending";
  }
  if (runStatus === "completed") return "done";
  if (runStatus === "cancelled") {
    return stepIndex <= currentStepIndex ? "done" : "pending";
  }
  if (stepIndex < currentStepIndex) return "done";
  if (
    stepIndex === currentStepIndex &&
    ["running", "waiting_job", "queued"].includes(runStatus)
  ) {
    return "running";
  }
  return "pending";
}

/** 从 Skill YAML + Run 进度构建只读 DAG（PROD-B01） */
export function buildDramaRunGraph(
  run: DramaRunRow,
  _projectRow: DramaProjectRow,
): DramaRunGraph {
  const skill = loadSkill(run.skill_id);

  const stepMeta = new Map<
    DramaPipelineStep,
    { label: string; type: string; skillStepId: string }
  >();

  for (const step of skill.steps) {
    const pipelineId = toPipelineStepId(step.id, run.skill_id);
    if (!pipelineId) continue;
    stepMeta.set(pipelineId, {
      label: step.label,
      type: step.type,
      skillStepId: step.id,
    });
  }

  const pipeline = resolveDramaPipelineSteps(run.skill_id);
  const nodes: DramaRunGraphNode[] = pipeline.map(
    (pipelineId, index) => {
      const meta = stepMeta.get(pipelineId);
      return {
        id: pipelineId,
        stepId: meta?.skillStepId ?? pipelineId,
        label: meta?.label ?? pipelineId,
        type: meta?.type ?? pipelineId,
        status: nodeStatus(index, run.current_step_index, run.status),
        index,
      };
    },
  );

  const edges: DramaRunGraphEdge[] = [];
  for (const step of skill.steps) {
    const target = toPipelineStepId(step.id, run.skill_id);
    if (!target) continue;
    for (const dep of skillStepDeps(step)) {
      const source = toPipelineStepId(dep, run.skill_id);
      if (!source || source === target) continue;
      const edgeId = `${source}->${target}`;
      if (!edges.some((e) => e.id === edgeId)) {
        edges.push({ id: edgeId, source, target });
      }
    }
  }

  if (edges.length === 0) {
    for (let i = 1; i < pipeline.length; i++) {
      const source = pipeline[i - 1]!;
      const target = pipeline[i]!;
      edges.push({ id: `${source}->${target}`, source, target });
    }
  }

  return {
    runId: run.id,
    skillId: run.skill_id,
    nodes,
    edges,
  };
}
