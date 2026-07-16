import { z } from "zod";

export const canvasItemSchema = z.object({
  id: z.string().min(1).max(80),
  url: z.string().max(2000).default(""),
  x: z.number(),
  y: z.number(),
  width: z.number().min(40).max(2000),
  height: z.number().min(40).max(2000),
  label: z.string().max(50).optional(),
  isVideo: z.boolean().optional(),
  source: z.enum(["upload", "generation"]).optional(),
  role: z.enum(["reference", "product", "output"]).optional(),
  assetId: z.string().uuid().optional(),
  outputId: z.string().uuid().optional(),
  batchId: z.string().min(1).max(120).optional(),
  batchIndex: z.number().int().min(-1).max(1000).optional(),
  batchTitle: z.string().max(100).optional(),
  batchSubtitle: z.string().max(120).optional(),
  parentBatchId: z.string().min(1).max(120).optional(),
  sourceItemId: z.string().min(1).max(120).optional(),
  infiniteNodeType: z.enum(["text", "config", "workflow"]).optional(),
  infiniteNodeMeta: z
    .object({
      content: z.string().max(8000).optional(),
      generationMode: z.enum(["text", "image", "video", "audio"]).optional(),
      prompt: z.string().max(4000).optional(),
      workflowToolType: z.string().max(80).optional(),
      workflowNodeKey: z.string().max(200).optional(),
      workflowJobId: z.string().uuid().optional(),
      connectedImageUrls: z.array(z.string().max(2000)).max(12).optional(),
      connectedVideoUrls: z.array(z.string().max(2000)).max(6).optional(),
      connectedAudioUrls: z.array(z.string().max(2000)).max(6).optional(),
    })
    .optional(),
});

export const canvasConnectionSchema = z.object({
  id: z.string().min(1).max(120),
  fromNodeId: z.string().min(1).max(120),
  toNodeId: z.string().min(1).max(120),
});

export const canvasLayoutSchema = z.object({
  version: z.literal(1).default(1),
  items: z.array(canvasItemSchema).max(80),
  /** @deprecated Phase E：InfiniteCanvas 已删除，仅向后兼容读取 legacy 数据 */
  infiniteConnections: z.array(canvasConnectionSchema).max(200).optional(),
  /** @deprecated Phase E：Drama 已下线，仅向后兼容读取 legacy 数据 */
  dramaNodePositions: z
    .record(
      z.string().min(1).max(120),
      z.object({ x: z.number(), y: z.number() }),
    )
    .optional(),
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

const COVER_URL_PATTERN = /^https?:\/\/|^\//;

/** 从 canvas_layout 提取首图 URL，供工作流列表封面 */
export function extractCanvasCoverUrl(
  raw: string | null | undefined,
): string | null {
  const layout = parseCanvasLayout(raw);
  if (!layout) return null;

  for (const item of layout.items) {
    if (item.isVideo) continue;
    const url = item.url?.trim();
    if (url && COVER_URL_PATTERN.test(url)) return url;
    const metaUrl = item.infiniteNodeMeta?.content?.trim();
    if (metaUrl && COVER_URL_PATTERN.test(metaUrl)) return metaUrl;
  }
  return null;
}
