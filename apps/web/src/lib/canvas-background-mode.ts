/**
 * P4.3 — 画布背景主题持久化
 *
 * 抽成纯函数模块，便于单测 + 在 overlay / canvas 之间复用。
 *
 * 持久化位置：localStorage["aimarket:canvas-background"]
 * 取值："dots" | "lines" | "blank"，非法值统一回退到 "dots"。
 */

export const CANVAS_BACKGROUND_STORAGE_KEY = "aimarket:canvas-background";

export type CanvasBackgroundMode = "dots" | "lines" | "blank";

export const DEFAULT_BACKGROUND_MODE: CanvasBackgroundMode = "dots";

const VALID: ReadonlySet<CanvasBackgroundMode> = new Set([
  "dots",
  "lines",
  "blank",
]);

/** 从 localStorage 读取当前背景模式（非法值/无值/SSR 全部回退到默认） */
export function readCanvasBackgroundMode(
  storage: Pick<Storage, "getItem"> | null | undefined,
): CanvasBackgroundMode {
  if (!storage) return DEFAULT_BACKGROUND_MODE;
  const raw = storage.getItem(CANVAS_BACKGROUND_STORAGE_KEY);
  if (raw && VALID.has(raw as CanvasBackgroundMode)) {
    return raw as CanvasBackgroundMode;
  }
  return DEFAULT_BACKGROUND_MODE;
}

/** 写入 localStorage（异常吞掉 — 隐私模式/quota） */
export function writeCanvasBackgroundMode(
  storage: Pick<Storage, "setItem"> | null | undefined,
  mode: CanvasBackgroundMode,
): void {
  if (!storage) return;
  try {
    storage.setItem(CANVAS_BACKGROUND_STORAGE_KEY, mode);
  } catch {
    // 忽略
  }
}
