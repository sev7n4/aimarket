export type ExpandDirection = "all" | "left" | "right" | "up" | "down";

export interface ExpandExtend {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
  direction?: ExpandDirection;
}

export function expandFromDirection(
  direction: string | null | undefined,
): ExpandExtend | undefined {
  if (!direction) return { direction: "all" };
  if (
    direction === "all" ||
    direction === "left" ||
    direction === "right" ||
    direction === "up" ||
    direction === "down"
  ) {
    return { direction };
  }
  return { direction: "all" };
}
