/** 画布焦点编辑：与 API `focusPointEntrySchema` 对齐 */
export type FocusEditIntent = "edit" | "replace";

export interface FocusPointChip {
  pointId: string;
  objectName: string;
  /** 归一化坐标 0–1，相对源图 */
  x: number;
  y: number;
  itemId: string;
}

export const MAX_FOCUS_POINTS = 10;

export const CROP_SIZE_OPTIONS = [
  { value: 64, label: "精细（64px）", hint: "适合小物体、文字" },
  { value: 128, label: "标准（128px）", hint: "推荐默认" },
  { value: 192, label: "宽松（192px）", hint: "适合中等物体" },
  { value: 256, label: "宽泛（256px）", hint: "适合大物体" },
];

export const DEFAULT_CROP_SIZE = 128;

export interface FocusEditSession {
  itemId: string;
  points: FocusPointChip[];
  intent: FocusEditIntent;
  cropSize: number;
}