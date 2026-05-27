import { z } from "zod";

export const canvasItemSchema = z.object({
  id: z.string().min(1).max(80),
  url: z.string().min(1).max(2000),
  x: z.number(),
  y: z.number(),
  width: z.number().min(40).max(2000),
  height: z.number().min(40).max(2000),
  label: z.string().max(50).optional(),
  isVideo: z.boolean().optional(),
  source: z.enum(["upload", "generation"]).optional(),
  role: z.enum(["reference", "product", "output"]).optional(),
  assetId: z.string().uuid().optional(),
});

export const canvasLayoutSchema = z.object({
  version: z.literal(1).default(1),
  items: z.array(canvasItemSchema).max(80),
});

export type CanvasLayout = z.infer<typeof canvasLayoutSchema>;

export function parseCanvasLayout(raw: string | null | undefined): CanvasLayout | null {
  if (!raw) return null;
  try {
    return canvasLayoutSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function serializeCanvasLayout(layout: CanvasLayout): string {
  return JSON.stringify(canvasLayoutSchema.parse(layout));
}
