import { z } from "zod";

/** 万相扩图 scale：各边输出尺寸相对原图该边的倍数，范围 [1.0, 2.0] */
export const EXPAND_SCALE_MIN = 1;
export const EXPAND_SCALE_MAX = 2;
export const EXPAND_SCALE_DEFAULT = 1.25;

export const expandDirectionSchema = z.enum([
  "all",
  "left",
  "right",
  "up",
  "down",
]);

export const expandExtendSchema = z.object({
  top: z.number().min(EXPAND_SCALE_MIN).max(EXPAND_SCALE_MAX).optional(),
  right: z.number().min(EXPAND_SCALE_MIN).max(EXPAND_SCALE_MAX).optional(),
  bottom: z.number().min(EXPAND_SCALE_MIN).max(EXPAND_SCALE_MAX).optional(),
  left: z.number().min(EXPAND_SCALE_MIN).max(EXPAND_SCALE_MAX).optional(),
  direction: expandDirectionSchema.optional(),
});

export type ExpandDirection = z.infer<typeof expandDirectionSchema>;
export type ExpandExtend = z.infer<typeof expandExtendSchema>;

export interface WanExpandScales {
  top_scale: number;
  bottom_scale: number;
  left_scale: number;
  right_scale: number;
}

function clampScale(n: number): number {
  return Math.min(EXPAND_SCALE_MAX, Math.max(EXPAND_SCALE_MIN, n));
}

/** 将 UI direction 或四向像素 extend 转为万相 top/right/bottom/left_scale */
export function resolveExpandScales(extend?: ExpandExtend | null): WanExpandScales {
  const neutral = 1;
  const active = EXPAND_SCALE_DEFAULT;

  if (!extend) {
    return {
      top_scale: active,
      bottom_scale: active,
      left_scale: active,
      right_scale: active,
    };
  }

  const hasExplicit =
    extend.top != null ||
    extend.right != null ||
    extend.bottom != null ||
    extend.left != null;

  if (hasExplicit) {
    return {
      top_scale: clampScale(extend.top ?? neutral),
      right_scale: clampScale(extend.right ?? neutral),
      bottom_scale: clampScale(extend.bottom ?? neutral),
      left_scale: clampScale(extend.left ?? neutral),
    };
  }

  switch (extend.direction) {
    case "left":
      return {
        top_scale: neutral,
        bottom_scale: neutral,
        left_scale: active,
        right_scale: neutral,
      };
    case "right":
      return {
        top_scale: neutral,
        bottom_scale: neutral,
        left_scale: neutral,
        right_scale: active,
      };
    case "up":
      return {
        top_scale: active,
        bottom_scale: neutral,
        left_scale: neutral,
        right_scale: neutral,
      };
    case "down":
      return {
        top_scale: neutral,
        bottom_scale: active,
        left_scale: neutral,
        right_scale: neutral,
      };
    case "all":
    default:
      return {
        top_scale: active,
        bottom_scale: active,
        left_scale: active,
        right_scale: active,
      };
  }
}
