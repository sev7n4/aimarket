import {
  characterTurnaroundRefsComplete,
  dispatchCharacterTurnaround,
  isCharacterTurnaroundBusy,
} from "./character-turnaround.js";
import { publishPlanEvent } from "./plan-events.js";
import { findRecentPlanRunByProjectId } from "./plan-runs.js";
import {
  dispatchSceneRef,
  isSceneRefBusy,
  sceneRefComplete,
} from "./scene-ref.js";
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
  const planRun = findRecentPlanRunByProjectId(userId, projectId);
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
      const message = err instanceof Error ? err.message : "角色三视图任务创建失败";
      console.warn("[drama-plan] character turnaround dispatch failed:", err);
      publishPlanEvent(input.runId, {
        type: "character_tool_failed",
        characterId: char.id,
        tool: "turnaround",
        error: message,
      });
    }
  }

  for (const scene of project.scenes) {
    if (sceneRefComplete(scene)) continue;
    if (isSceneRefBusy(input.projectId, scene.id)) continue;

    publishPlanEvent(input.runId, {
      type: "scene_tool_start",
      sceneId: scene.id,
      sceneName: scene.name,
    });
    try {
      dispatchSceneRef(input.userId, input.projectId, scene.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "场景参考图任务创建失败";
      console.warn("[drama-plan] scene ref dispatch failed:", err);
      publishPlanEvent(input.runId, {
        type: "scene_tool_failed",
        sceneId: scene.id,
        error: message,
      });
    }
  }
}

export function notifyPlanningTurnaroundProgress(
  userId: string,
  projectId: string,
  characterId: string,
  failed?: boolean,
) {
  publishProjectSnapshotForPlanning(userId, projectId);

  const planRun = findRecentPlanRunByProjectId(userId, projectId);
  if (!planRun) return;

  if (failed) {
    publishPlanEvent(planRun.id, {
      type: "character_tool_failed",
      characterId,
      tool: "turnaround",
      error: "图像生成失败，请检查积分或图像服务配置后重试",
    });
    return;
  }

  const project = getEnrichedProjectData(userId, projectId);
  const char = project?.characters.find((c) => c.id === characterId);
  if (!char) return;
  if (
    characterTurnaroundRefsComplete(char) &&
    !isCharacterTurnaroundBusy(projectId, characterId)
  ) {
    publishPlanEvent(planRun.id, {
      type: "character_tool_done",
      characterId,
      tool: "turnaround",
    });
  }
}

export function notifyPlanningSceneRefProgress(
  userId: string,
  projectId: string,
  sceneId: string,
  failed?: boolean,
) {
  publishProjectSnapshotForPlanning(userId, projectId);

  const planRun = findRecentPlanRunByProjectId(userId, projectId);
  if (!planRun) return;

  if (failed) {
    publishPlanEvent(planRun.id, {
      type: "scene_tool_failed",
      sceneId,
      error: "场景图生成失败，请检查积分或图像服务配置后重试",
    });
    return;
  }

  const project = getEnrichedProjectData(userId, projectId);
  const scene = project?.scenes.find((s) => s.id === sceneId);
  if (!scene) return;
  if (sceneRefComplete(scene) && !isSceneRefBusy(projectId, sceneId)) {
    publishPlanEvent(planRun.id, {
      type: "scene_tool_done",
      sceneId,
    });
  }
}
