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

export interface FocusEditSession {
  itemId: string;
  points: FocusPointChip[];
  intent: FocusEditIntent;
}
