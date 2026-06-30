import { CanvasNodeType, type CanvasNodeMetadata } from "./types";

type CanvasNodeSpec = {
  width: number;
  height: number;
  title: string;
  metadata?: CanvasNodeMetadata;
};

export const NODE_DEFAULT_SIZE = {
  [CanvasNodeType.Image]: { width: 340, height: 240, title: "New Generation" },
  [CanvasNodeType.Text]: { width: 340, height: 240, title: "Note" },
  [CanvasNodeType.Config]: { width: 340, height: 240, title: "生成配置" },
  [CanvasNodeType.Video]: { width: 420, height: 236, title: "Video" },
  [CanvasNodeType.Audio]: { width: 340, height: 120, title: "Audio" },
  [CanvasNodeType.Script]: { width: 400, height: 300, title: "新剧本" },
  [CanvasNodeType.Shot]: { width: 360, height: 260, title: "新分镜" },
  [CanvasNodeType.Character]: { width: 340, height: 280, title: "新角色" },
  [CanvasNodeType.Scene]: { width: 360, height: 240, title: "新场景" },
} satisfies Record<CanvasNodeType, { width: number; height: number; title: string }>;

export const NODE_SPECS = {
  [CanvasNodeType.Image]: {
    ...NODE_DEFAULT_SIZE[CanvasNodeType.Image],
    metadata: { content: "", status: "idle" as const },
  },
  [CanvasNodeType.Text]: {
    ...NODE_DEFAULT_SIZE[CanvasNodeType.Text],
    metadata: { content: "", status: "idle" as const, fontSize: 14 },
  },
  [CanvasNodeType.Config]: {
    ...NODE_DEFAULT_SIZE[CanvasNodeType.Config],
    metadata: { content: "", status: "idle" as const, generationMode: "image" as const },
  },
  [CanvasNodeType.Video]: {
    ...NODE_DEFAULT_SIZE[CanvasNodeType.Video],
    metadata: { content: "", status: "idle" as const },
  },
  [CanvasNodeType.Audio]: {
    ...NODE_DEFAULT_SIZE[CanvasNodeType.Audio],
    metadata: { content: "", status: "idle" as const },
  },
  [CanvasNodeType.Script]: {
    ...NODE_DEFAULT_SIZE[CanvasNodeType.Script],
    metadata: { content: "", status: "idle" as const },
  },
  [CanvasNodeType.Shot]: {
    ...NODE_DEFAULT_SIZE[CanvasNodeType.Shot],
    metadata: { content: "", status: "idle" as const },
  },
  [CanvasNodeType.Character]: {
    ...NODE_DEFAULT_SIZE[CanvasNodeType.Character],
    metadata: { content: "", status: "idle" as const },
  },
  [CanvasNodeType.Scene]: {
    ...NODE_DEFAULT_SIZE[CanvasNodeType.Scene],
    metadata: { content: "", status: "idle" as const },
  },
} satisfies Record<CanvasNodeType, CanvasNodeSpec>;

export function getNodeSpec(type: CanvasNodeType) {
  return NODE_SPECS[type];
}
