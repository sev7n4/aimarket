import { randomUUID } from "@/lib/uuid";
import type {
  DramaCharacterCard,
  DramaProjectPayload,
  DramaSceneCard,
  DramaStoryboardShot,
} from "@/lib/types";
import { getNodeSpec } from "../constants";
import type { CanvasAgentOp } from "../utils";
import { CanvasNodeType } from "../types";

const DRAMA_NODE_TYPES = new Set<CanvasNodeType>([
  CanvasNodeType.Script,
  CanvasNodeType.Shot,
  CanvasNodeType.Character,
  CanvasNodeType.Scene,
]);

export function isDramaCanvasNodeType(type: CanvasNodeType): boolean {
  return DRAMA_NODE_TYPES.has(type);
}

export function parseDramaEntityId(nodeId: string): {
  kind: "script" | "character" | "scene" | "shot";
  entityId?: string;
} | null {
  if (nodeId === "drama-script") return { kind: "script" };
  if (nodeId.startsWith("drama-char-")) {
    return { kind: "character", entityId: nodeId.slice("drama-char-".length) };
  }
  if (nodeId.startsWith("drama-scene-")) {
    return { kind: "scene", entityId: nodeId.slice("drama-scene-".length) };
  }
  if (nodeId.startsWith("drama-shot-")) {
    return { kind: "shot", entityId: nodeId.slice("drama-shot-".length) };
  }
  return null;
}

function defaultVisualSignature() {
  return {
    ageRange: "青年",
    faceShape: "鹅蛋脸",
    eyeShape: "杏眼",
    hairStyle: "短发",
    skinTone: "自然",
    signatureOutfit: "日常装",
    distinguishingFeatures: [] as string[],
  };
}

function defaultCharacter(name: string): DramaCharacterCard {
  return {
    id: randomUUID(),
    name,
    role: "配角",
    personalityTone: "待补充",
    promptAnchor: "待补充角色外观描述",
    visualSignature: defaultVisualSignature(),
    turnaroundStatus: "draft",
  };
}

function defaultScene(name: string): DramaSceneCard {
  return {
    id: randomUUID(),
    name,
    location: "待补充",
    atmosphere: "待补充",
    promptAnchor: "待补充场景描述",
    props: [],
  };
}

function defaultShot(project: DramaProjectPayload, order: number): DramaStoryboardShot {
  const sceneId = project.scenes[0]?.id ?? randomUUID();
  const characterIds = project.characters[0]?.id ? [project.characters[0].id] : [];
  return {
    id: randomUUID(),
    order,
    sceneId,
    characterIds,
    dialogue: [],
    visualPrompt: "待补充分镜画面描述",
    motionPrompt: "待补充运镜描述",
    cameraSpec: {
      shotSize: "中景",
      movement: "固定",
      lighting: "自然光",
    },
    durationSec: 3,
    useLastFrameContinuity: false,
    status: "pending",
  };
}

function ensureScript(project: DramaProjectPayload): DramaProjectPayload {
  if (project.script?.title) return project;
  return {
    ...project,
    script: {
      title: "新剧本",
      logline: "待补充故事梗概",
      acts: [],
      narratorLines: [],
    },
  };
}

function addDramaNode(
  project: DramaProjectPayload,
  op: Extract<CanvasAgentOp, { type: "add_node" }>,
): DramaProjectPayload {
  const nodeType = op.nodeType;
  if (!nodeType || !isDramaCanvasNodeType(nodeType)) return project;

  const title = op.title || getNodeSpec(nodeType).title;

  if (nodeType === CanvasNodeType.Script) {
    return ensureScript({
      ...project,
      script: {
        ...project.script,
        title,
        logline: project.script?.logline || "待补充故事梗概",
        acts: project.script?.acts ?? [],
        narratorLines: project.script?.narratorLines ?? [],
      },
    });
  }

  if (nodeType === CanvasNodeType.Character) {
    const character = defaultCharacter(title);
    return { ...project, characters: [...project.characters, character] };
  }

  if (nodeType === CanvasNodeType.Scene) {
    const scene = defaultScene(title);
    return { ...project, scenes: [...project.scenes, scene] };
  }

  if (nodeType === CanvasNodeType.Shot) {
    const order =
      project.shots.length > 0
        ? Math.max(...project.shots.map((s) => s.order)) + 1
        : 1;
    const shot = defaultShot(project, order);
    return { ...project, shots: [...project.shots, shot] };
  }

  return project;
}

function removeDramaNodes(
  project: DramaProjectPayload,
  nodeIds: string[],
): DramaProjectPayload {
  let next = { ...project };
  for (const nodeId of nodeIds) {
    const parsed = parseDramaEntityId(nodeId);
    if (!parsed) continue;
    if (parsed.kind === "script") {
      next = {
        ...next,
        script: {
          title: "",
          logline: "",
          acts: [],
          narratorLines: [],
        },
      };
    } else if (parsed.kind === "character" && parsed.entityId) {
      next = {
        ...next,
        characters: next.characters.filter((c) => c.id !== parsed.entityId),
        shots: next.shots.map((s) => ({
          ...s,
          characterIds: s.characterIds.filter((id) => id !== parsed.entityId),
        })),
      };
    } else if (parsed.kind === "scene" && parsed.entityId) {
      next = {
        ...next,
        scenes: next.scenes.filter((s) => s.id !== parsed.entityId),
        shots: next.shots.filter((s) => s.sceneId !== parsed.entityId),
      };
    } else if (parsed.kind === "shot" && parsed.entityId) {
      next = {
        ...next,
        shots: next.shots.filter((s) => s.id !== parsed.entityId),
      };
    }
  }
  return next;
}

/** 将画布增删 Op 写回 DramaProjectPayload */
export function applyDramaCanvasOps(
  project: DramaProjectPayload,
  ops: CanvasAgentOp[],
): DramaProjectPayload {
  let next = project;
  for (const op of ops) {
    if (op.type === "add_node" && op.nodeType && isDramaCanvasNodeType(op.nodeType)) {
      next = addDramaNode(next, op);
    }
    if (op.type === "delete_node") {
      const ids = op.ids ?? (op.id ? [op.id] : []);
      const dramaIds = ids.filter((id) => parseDramaEntityId(id));
      if (dramaIds.length > 0) next = removeDramaNodes(next, dramaIds);
    }
  }
  return next;
}

export function extractDramaCanvasOps(ops: CanvasAgentOp[]): CanvasAgentOp[] {
  return ops.filter((op) => {
    if (op.type === "add_node") {
      return op.nodeType != null && isDramaCanvasNodeType(op.nodeType);
    }
    if (op.type === "delete_node") {
      const ids = op.ids ?? (op.id ? [op.id] : []);
      return ids.some((id) => parseDramaEntityId(id));
    }
    return false;
  });
}
