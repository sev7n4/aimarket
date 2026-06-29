/**
 * 1.1 画布节点数据模型
 * 定义节点式无限画布的核心类型，与 React Flow 集成。
 */

/** 六种节点类型 */
export type CanvasNodeType =
  | "script"
  | "image"
  | "video"
  | "audio"
  | "text"
  | "output";

/** 节点端口：输入/输出连接点 */
export interface CanvasNodePort {
  id: string;
  type: "input" | "output";
  label: string;
}

/** 节点数据 */
export interface CanvasNodeData {
  type: CanvasNodeType;
  label: string;
  assetId?: string;
  outputId?: string;
  prompt?: string;
  params?: Record<string, unknown>;
}

/** React Flow 节点类型 */
export interface CanvasFlowNode {
  id: string;
  type: CanvasNodeType;
  position: { x: number; y: number };
  data: CanvasNodeData;
}

/** React Flow 边类型 */
export interface CanvasFlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  /** 边语义：reference（参考，灰色虚线）/ trigger（触发，紫色实线）。默认 trigger。 */
  kind?: "reference" | "trigger";
}

/** 画布流完整结构 */
export interface CanvasFlow {
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  viewport?: { x: number; y: number; zoom: number };
}

/**
 * 每种节点类型的默认端口定义
 * - script: 1输入 + 1输出
 * - image:  1输入 + 1输出
 * - video:  1输入 + 2输出（video + audio）
 * - audio:  0输入 + 1输出
 * - text:   0输入 + 1输出
 */
export const NODE_DEFAULT_PORTS: Record<CanvasNodeType, CanvasNodePort[]> = {
  script: [
    { id: "input-0", type: "input", label: "输入" },
    { id: "output-0", type: "output", label: "输出" },
  ],
  image: [
    { id: "input-0", type: "input", label: "输入" },
    { id: "output-0", type: "output", label: "输出" },
  ],
  video: [
    { id: "input-0", type: "input", label: "输入" },
    { id: "output-video", type: "output", label: "视频" },
    { id: "output-audio", type: "output", label: "音频" },
  ],
  audio: [
    { id: "output-0", type: "output", label: "输出" },
  ],
  text: [
    { id: "output-0", type: "output", label: "输出" },
  ],
  output: [
    { id: "input-0", type: "input", label: "输入" },
  ],
};

/** 节点类型中文标签 */
export const NODE_TYPE_LABELS: Record<CanvasNodeType, string> = {
  script: "脚本",
  image: "图片",
  video: "视频",
  audio: "音频",
  text: "文本",
  output: "输出",
};

/** 节点类型说明 */
export const NODE_TYPE_DESCRIPTIONS: Record<CanvasNodeType, string> = {
  script: "AI 脚本节点，可输入 prompt",
  image: "图片节点，支持缩略图与参考图上传",
  video: "视频节点，输出视频与音频双轨",
  audio: "音频节点，提供音频源",
  text: "文本节点，输入纯文本内容",
  output: "输出节点，Agent Run 完成后展示最终产物",
};

/**
 * 连线验证：判断 sourceHandle 是否允许连接到 targetHandle
 * - video 节点的 audio output 只能连到 audio input
 * - 其他 output 可连到任意 input
 */
export function isValidConnection(
  sourceNodeType: CanvasNodeType,
  sourceHandle: string | null | undefined,
  targetNodeType: CanvasNodeType,
  targetHandle: string | null | undefined,
): boolean {
  // 目标节点没有输入端口则不允许连接
  const targetPorts = NODE_DEFAULT_PORTS[targetNodeType];
  const targetInputs = targetPorts.filter((p) => p.type === "input");
  if (targetInputs.length === 0) return false;

  // video 节点的音频输出只能连到有音频输入的节点
  if (
    sourceNodeType === "video" &&
    sourceHandle === "output-audio"
  ) {
    // 音频输出只能连到有输入端口的节点（image/script 的 input-0）
    return targetInputs.length > 0;
  }

  // 通用规则：目标必须有至少一个输入端口
  return true;
}
