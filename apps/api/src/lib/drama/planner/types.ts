import type {
  CharacterCard,
  DramaScript,
  SceneCard,
  StoryboardShot,
  StyleBible,
} from "../schema.js";

export interface PlanDramaInput {
  userIdea: string;
  targetDurationSec?: number;
  aspectRatio?: "9:16" | "16:9";
}

export type DramaPlanAgentId =
  | "writer"
  | "director"
  | "character"
  | "cinematographer"
  | "storyboard";

export const DRAMA_PLAN_AGENT_ORDER: DramaPlanAgentId[] = [
  "writer",
  "director",
  "character",
  "cinematographer",
  "storyboard",
];

export interface WriterShotSkeleton {
  id: string;
  order: number;
  sceneId: string;
  characterIds: string[];
  dialogue: Array<{ characterId: string; line: string }>;
}

export interface WriterOutput {
  title: string;
  logline: string;
  acts: DramaScript["acts"];
  narratorLines: string[];
  scenes: SceneCard[];
  shots: WriterShotSkeleton[];
}

export interface DirectorOutput {
  styleBible: StyleBible;
  productionNotes?: string;
}

export interface CharacterOutput {
  characters: CharacterCard[];
}

export interface CinematographerShotPatch {
  id: string;
  cameraSpec: StoryboardShot["cameraSpec"];
  motionPrompt: string;
}

export interface CinematographerOutput {
  shots: CinematographerShotPatch[];
}

export interface StoryboardOutput {
  shots: Array<
    Pick<
      StoryboardShot,
      | "id"
      | "order"
      | "sceneId"
      | "characterIds"
      | "dialogue"
      | "visualPrompt"
      | "motionPrompt"
      | "cameraSpec"
      | "durationSec"
      | "useLastFrameContinuity"
    >
  >;
}

export interface PlanningContext {
  input: PlanDramaInput;
  duration: number;
  aspectRatio: "9:16" | "16:9";
  writer?: WriterOutput;
  director?: DirectorOutput;
  character?: CharacterOutput;
  cinematographer?: CinematographerOutput;
  storyboard?: StoryboardOutput;
}

export interface AgentStepResult<T> {
  output: T;
  reasoning?: string;
}

export type DramaPlanRunStatus = "planning" | "completed" | "failed";

export type DramaPlanAgentStatus =
  | "pending"
  | "running"
  | "done"
  | "failed";

export interface DramaPlanAgentState {
  status: DramaPlanAgentStatus;
  reasoning?: string;
  summary?: string;
  completedAt?: string;
}

export type DramaPlanAgentsJson = Record<
  DramaPlanAgentId,
  DramaPlanAgentState
>;

export type DramaPlanEvent =
  | { type: "agent_start"; agent: DramaPlanAgentId }
  | { type: "agent_reasoning"; agent: DramaPlanAgentId; chunk: string }
  | { type: "agent_done"; agent: DramaPlanAgentId; summary: string }
  | {
      type: "plan_complete";
      projectId: string;
      estimatedPoints: number;
      dramaRunId?: string;
      produceSkippedReason?: string;
    }
  | { type: "plan_failed"; error: string };

export type DramaPlanEmit = (event: DramaPlanEvent) => void;

export const DRAMA_PLAN_AGENT_LABELS: Record<DramaPlanAgentId, string> = {
  writer: "编剧",
  director: "导演",
  character: "角色",
  cinematographer: "摄影",
  storyboard: "分镜",
};
