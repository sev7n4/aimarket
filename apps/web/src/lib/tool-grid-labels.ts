/** 批量宫格工具 ID → 前端展示标签（与后端 Provider 顺序对齐） */

export const TOOL_GRID_TOOL_IDS = [
  "multi-cam-9",
  "multi-cam-25",
  "storyboard-evolve",
  "turnaround-360",
] as const;

export type ToolGridToolId = (typeof TOOL_GRID_TOOL_IDS)[number];

export function isToolGridToolId(id: string): id is ToolGridToolId {
  return (TOOL_GRID_TOOL_IDS as readonly string[]).includes(id);
}

const MULTI_CAM_9_LABELS = [
  "俯拍",
  "仰拍",
  "左45°",
  "右45°",
  "正面",
  "背面",
  "近景",
  "远景",
  "特写",
];

const TURNAROUND_360_LABELS = [
  "正面",
  "左前方",
  "左侧",
  "左后方",
  "背面",
  "右后方",
  "右侧",
  "右前方",
];

const STORYBOARD_EVOLVE_LABELS = ["3秒前", "当前帧", "3秒后", "5秒后"];

export function labelsForToolGrid(
  toolId: ToolGridToolId,
  count: number,
): string[] {
  const base =
    toolId === "multi-cam-9"
      ? MULTI_CAM_9_LABELS
      : toolId === "turnaround-360"
        ? TURNAROUND_360_LABELS
        : toolId === "storyboard-evolve"
          ? STORYBOARD_EVOLVE_LABELS
          : Array.from({ length: count }, (_, i) => `镜头 ${i + 1}`);

  return base.slice(0, count).map((label, i) => base[i] ?? `图 ${i + 1}`);
}

export function gridLayoutForTool(
  toolId: ToolGridToolId,
): { cols: number; rows: number } {
  switch (toolId) {
    case "multi-cam-9":
      return { cols: 3, rows: 3 };
    case "multi-cam-25":
      return { cols: 5, rows: 5 };
    case "storyboard-evolve":
      return { cols: 2, rows: 2 };
    case "turnaround-360":
      return { cols: 4, rows: 2 };
    default:
      return { cols: 3, rows: 3 };
  }
}

export function titleForToolGrid(toolId: ToolGridToolId): string {
  switch (toolId) {
    case "multi-cam-9":
      return "多机位 9 宫格";
    case "multi-cam-25":
      return "多机位 25 宫格";
    case "storyboard-evolve":
      return "剧情推演四宫格";
    case "turnaround-360":
      return "360° 角度呈现";
    default:
      return "批量结果";
  }
}
