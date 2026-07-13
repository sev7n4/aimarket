const BASE_STEP = 40;
const SHIFT_MULT = 2.5;

export function panDeltaFromKey(
  key: string,
  shift: boolean,
  step = BASE_STEP,
): { dx: number; dy: number } | null {
  const k = key.toLowerCase();
  const s = shift ? step * SHIFT_MULT : step;
  if (k === "w") return { dx: 0, dy: -s };
  if (k === "s") return { dx: 0, dy: s };
  if (k === "a") return { dx: -s, dy: 0 };
  if (k === "d") return { dx: s, dy: 0 };
  return null;
}

export function zoomFactorFromKey(key: string): number | null {
  const k = key.toLowerCase();
  if (k === "e") return 1.1;
  if (k === "q") return 1 / 1.1;
  return null;
}

export function shouldStartPan(input: {
  spacePressed: boolean;
  button: number;
  rightDragMoved: boolean;
}): boolean {
  if (input.button === 1) return true;
  if (input.spacePressed && input.button === 0) return true;
  if (input.button === 2 && input.rightDragMoved) return true;
  return false;
}

export function isContextMenuClick(movedPx: number, threshold = 4): boolean {
  return movedPx < threshold;
}
