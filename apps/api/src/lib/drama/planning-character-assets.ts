import {
  characterTurnaroundRefsComplete,
  dispatchCharacterTurnaround,
  isCharacterTurnaroundBusy,
} from "./character-turnaround.js";
import { publishPlanEvent } from "./plan-events.js";
import { findPlanningPlanRunByProjectId } from "./plan-runs.js";
import {
  getEnrichedProjectData,
  getDramaProject,
  parseProjectJson,
  updateDramaProject,
} from "./projects.js";
import type { CharacterCard } from "./schema.js";
import {
  inferVoiceIdFromStyle,
  DRAMA_VOICE_CATALOG,
} from "./voice-catalog.js";

function normalizeCharacterVoices(characters: CharacterCard[]): CharacterCard[] {
  return characters.map((char) => {
    const voiceId = char.voiceId ?? inferVoiceIdFromStyle(char.voiceStyle);
    const catalog = DRAMA_VOICE_CATALOG.find((v) => v.id === voiceId);
    return {
      ...char,
      voiceId,
      voiceStyle: char.voiceStyle ?? catalog?.label,
    };
  });
}

export function publishProjectSnapshotForPlanning(
  userId: string,
  projectId: string,
) {
  const planRun = findPlanningPlanRunByProjectId(userId, projectId);
  if (!planRun) return;
  const project = getEnrichedProjectData(userId, projectId);
  if (!project) return;
  publishPlanEvent(planRun.id, {
    type: "project_snapshot",
    projectId,
    project,
  });
}

export function dispatchPlanningCharacterTurnarounds(input: {
  runId: string;
  userId: string;
  projectId: string;
}) {
  const row = getDramaProject(input.userId, input.projectId);
  if (!row) return;

  let project = parseProjectJson(row);
  project = {
    ...project,
    characters: normalizeCharacterVoices(project.characters),
  };
  updateDramaProject(input.projectId, { project }, { userId: input.userId, skipSnapshot: true });

  publishPlanEvent(input.runId, {
    type: "project_snapshot",
    projectId: input.projectId,
    project: getEnrichedProjectData(input.userId, input.projectId)!,
  });

  for (const char of project.characters) {
    publishPlanEvent(input.runId, {
      type: "character_tool_start",
      characterId: char.id,
      characterName: char.name,
      tool: "voice",
    });
    publishPlanEvent(input.runId, {
      type: "character_tool_done",
      characterId: char.id,
      tool: "voice",
    });

    if (characterTurnaroundRefsComplete(char)) continue;
    if (isCharacterTurnaroundBusy(input.projectId, char.id)) continue;

    publishPlanEvent(input.runId, {
      type: "character_tool_start",
      characterId: char.id,
      characterName: char.name,
      tool: "turnaround",
    });
    try {
      dispatchCharacterTurnaround(input.userId, input.projectId, char.id);
    } catch (err) {
      console.warn("[drama-plan] character turnaround dispatch failed:", err);
    }
  }
}

export function notifyPlanningTurnaroundProgress(
  userId: string,
  projectId: string,
  characterId: string,
) {
  publishProjectSnapshotForPlanning(userId, projectId);

  const project = getEnrichedProjectData(userId, projectId);
  const char = project?.characters.find((c) => c.id === characterId);
  if (!char) return;
  if (
    characterTurnaroundRefsComplete(char) &&
    !isCharacterTurnaroundBusy(projectId, characterId)
  ) {
    const planRun = findPlanningPlanRunByProjectId(userId, projectId);
    if (!planRun) return;
    publishPlanEvent(planRun.id, {
      type: "character_tool_done",
      characterId,
      tool: "turnaround",
    });
  }
}
