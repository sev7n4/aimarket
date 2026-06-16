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
