export const DEFAULT_GRID_SIZE = 20;

/** 将坐标吸附到网格 */
export function snapToGrid(
  value: number,
  gridSize: number = DEFAULT_GRID_SIZE,
): number {
  if (gridSize <= 0) return value;
  return Math.round(value / gridSize) * gridSize;
}

export function snapPositionToGrid(
  position: { x: number; y: number },
  gridSize: number = DEFAULT_GRID_SIZE,
): { x: number; y: number } {
  return {
    x: snapToGrid(position.x, gridSize),
    y: snapToGrid(position.y, gridSize),
  };
}

/**
 * Shift 拖拽轴向约束：取位移绝对值更大的轴，另一轴归零。
 */
export function constrainAxisDelta(
  dx: number,
  dy: number,
  lockAxis: boolean,
): { dx: number; dy: number } {
  if (!lockAxis) return { dx, dy };
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { dx, dy: 0 };
  }
  return { dx: 0, dy };
}

export function applyDragDelta(
  initial: { x: number; y: number },
  dx: number,
  dy: number,
  options?: {
    lockAxis?: boolean;
    snapGrid?: boolean;
    gridSize?: number;
  },
): { x: number; y: number } {
  const constrained = constrainAxisDelta(dx, dy, Boolean(options?.lockAxis));
  const next = {
    x: initial.x + constrained.dx,
    y: initial.y + constrained.dy,
  };
  if (options?.snapGrid) {
    return snapPositionToGrid(next, options.gridSize ?? DEFAULT_GRID_SIZE);
  }
  return next;
}
