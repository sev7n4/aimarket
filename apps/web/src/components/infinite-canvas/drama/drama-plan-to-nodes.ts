import type { DramaProjectPayload, DramaCharacterCard, DramaSceneCard, DramaStoryboardShot } from "@/lib/types";
import {
  CanvasNodeType,
  type CanvasNodeData,
  type CanvasConnection,
} from "../types";
import { getNodeSpec } from "../constants";

/**
 * Convert a DramaProjectData (from the 5-agent pipeline) into
 * canvas nodes and connections for the infinite canvas.
 *
 * Layout:
 *   Script    at x=0
 *   Characters at x=500, evenly spaced vertically
 *   Scenes    at x=500, below characters, evenly spaced vertically
 *   Shots     at x=1000, evenly spaced vertically
 *
 * Connections:
 *   script  → shot      (one per shot)
 *   character → shot    (per shot.characterIds)
 *   scene → shot        (per shot.sceneId)
 */
export function dramaPlanToCanvasNodes(
  project: DramaProjectPayload,
): { nodes: CanvasNodeData[]; connections: CanvasConnection[] } {
  const nodes: CanvasNodeData[] = [];
  const connections: CanvasConnection[] = [];
  let connIndex = 0;

  const GAP_X = 500;
  const GAP_Y = 40;

  // ── Script node ──
  const scriptSpec = getNodeSpec(CanvasNodeType.Script);
  const scriptNode: CanvasNodeData = {
    id: `drama-script`,
    type: CanvasNodeType.Script,
    title: project.script?.title || "剧本",
    position: { x: 0, y: 0 },
    width: scriptSpec.width,
    height: scriptSpec.height,
    metadata: {
      scriptTitle: project.script?.title,
      logline: project.script?.logline,
      actCount: project.script?.acts?.length,
      narratorLineCount: project.script?.narratorLines?.length,
    },
  };
  nodes.push(scriptNode);

  // ── Character nodes ──
  const characterNodes = new Map<string, CanvasNodeData>();
  const characters: DramaCharacterCard[] = project.characters || [];
  characters.forEach((char: DramaCharacterCard, i: number) => {
    const spec = getNodeSpec(CanvasNodeType.Character);
    const node: CanvasNodeData = {
      id: `drama-char-${char.id}`,
      type: CanvasNodeType.Character,
      title: char.name,
      position: { x: GAP_X, y: i * (spec.height + GAP_Y) },
      width: spec.width,
      height: spec.height,
      metadata: {
        characterName: char.name,
        characterRole: char.role,
        personalityTone: char.personalityTone,
        promptAnchor: char.promptAnchor,
        turnaroundStatus: char.turnaroundStatus,
        refUrl: char.refUrl,
      },
    };
    nodes.push(node);
    characterNodes.set(char.id, node);
  });

  // ── Scene nodes ──
  const sceneNodes = new Map<string, CanvasNodeData>();
  const scenes = project.scenes || [];
  const sceneStartY =
    characters.length * (getNodeSpec(CanvasNodeType.Character).height + GAP_Y);
  scenes.forEach((scene: DramaSceneCard, i: number) => {
    const spec = getNodeSpec(CanvasNodeType.Scene);
    const node: CanvasNodeData = {
      id: `drama-scene-${scene.id}`,
      type: CanvasNodeType.Scene,
      title: scene.name,
      position: { x: GAP_X, y: sceneStartY + i * (spec.height + GAP_Y) },
      width: spec.width,
      height: spec.height,
      metadata: {
        sceneName: scene.name,
        location: scene.location,
        atmosphere: scene.atmosphere,
        era: scene.era,
        scenePromptAnchor: scene.promptAnchor,
        sceneRefUrl: scene.refUrl,
      },
    };
    nodes.push(node);
    sceneNodes.set(scene.id, node);
  });

  // ── Shot nodes ──
  const shots = project.shots || [];
  const shotSpec = getNodeSpec(CanvasNodeType.Shot);
  shots.forEach((shot: DramaStoryboardShot, i: number) => {
    const dialoguePreview = shot.dialogue
      ?.map((d: { characterId: string; line: string }) => d.line)
      .join(" / ")
      .slice(0, 80);

    const node: CanvasNodeData = {
      id: `drama-shot-${shot.id}`,
      type: CanvasNodeType.Shot,
      title: `分镜 #${shot.order ?? i + 1}`,
      position: { x: GAP_X * 2, y: i * (shotSpec.height + GAP_Y) },
      width: shotSpec.width,
      height: shotSpec.height,
      metadata: {
        shotOrder: shot.order ?? i + 1,
        sceneId: shot.sceneId,
        characterIds: shot.characterIds,
        dialogue: dialoguePreview,
        visualPrompt: shot.visualPrompt,
        motionPrompt: shot.motionPrompt,
        cameraShotSize: shot.cameraSpec?.shotSize,
        cameraMovement: shot.cameraSpec?.movement,
        cameraLighting: shot.cameraSpec?.lighting,
        durationSec: shot.durationSec,
        shotStatus: shot.status,
        keyframeOutputId: shot.keyframeOutputId,
        keyframeVariantUrls: shot.keyframeVariantUrls,
        keyframeHeroIndex: shot.keyframeHeroIndex,
        videoOutputId: shot.videoOutputId,
      },
    };
    nodes.push(node);

    // Connections: script → shot
    connections.push({
      id: `conn-${connIndex++}`,
      fromNodeId: scriptNode.id,
      toNodeId: node.id,
    });

    // Connections: character → shot
    for (const charId of shot.characterIds || []) {
      const charNode = characterNodes.get(charId);
      if (charNode) {
        connections.push({
          id: `conn-${connIndex++}`,
          fromNodeId: charNode.id,
          toNodeId: node.id,
        });
      }
    }

    // Connections: scene → shot
    if (shot.sceneId) {
      const sceneNode = sceneNodes.get(shot.sceneId);
      if (sceneNode) {
        connections.push({
          id: `conn-${connIndex++}`,
          fromNodeId: sceneNode.id,
          toNodeId: node.id,
        });
      }
    }
  });

  return { nodes, connections };
}

/** 将持久化的 Drama 节点坐标覆盖到规划布局上 */
export function applyDramaNodePositions(
  data: { nodes: CanvasNodeData[]; connections: CanvasConnection[] },
  positions?: Record<string, { x: number; y: number }> | null,
): { nodes: CanvasNodeData[]; connections: CanvasConnection[] } {
  if (!positions || Object.keys(positions).length === 0) return data;
  return {
    ...data,
    nodes: data.nodes.map((node) => {
      const pos = positions[node.id];
      if (!pos) return node;
      return { ...node, position: { x: pos.x, y: pos.y } };
    }),
  };
}
