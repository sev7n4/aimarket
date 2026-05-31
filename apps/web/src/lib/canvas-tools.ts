import type { LucideIcon } from "lucide-react";
import { randomUUID } from "@/lib/uuid";
import { TOOL_DISPLAY_NAMES, formatToolProviderLabel } from "@/lib/studio-tool-meta";
import {
  Download,
  Grid3x3,
  Hand,
  ImagePlus,
  LayoutGrid,
  List,
  Maximize2,
  MousePointer2,
  Redo2,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

export type CanvasToolId =
  | "select"
  | "pan"
  | "zoom-in"
  | "zoom-out"
  | "fit"
  | "upload"
  | "download"
  | "delete"
  | "grid"
  | "layout-scroll"
  | "layout-free"
  | "undo"
  | "redo"
  | "preview";

export type CanvasLayoutMode = "scroll" | "free";

export interface CanvasToolDef {
  id: CanvasToolId;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
}

export const canvasTools: CanvasToolDef[] = [
  { id: "select", label: "选择 / 拖拽", icon: MousePointer2, shortcut: "V" },
  { id: "pan", label: "移动画布", icon: Hand, shortcut: "Space" },
  { id: "zoom-in", label: "放大", icon: ZoomIn },
  { id: "zoom-out", label: "缩小", icon: ZoomOut },
  { id: "fit", label: "适应画布", icon: Maximize2 },
  { id: "layout-scroll", label: "纵向滚动", icon: List },
  { id: "layout-free", label: "自由布局", icon: LayoutGrid },
  { id: "undo", label: "撤销", icon: Undo2, shortcut: "⌘Z" },
  { id: "redo", label: "重做", icon: Redo2, shortcut: "⌘⇧Z" },
  { id: "upload", label: "上传图片", icon: ImagePlus },
  { id: "download", label: "下载", icon: Download },
  { id: "delete", label: "删除选中", icon: Trash2, shortcut: "Del" },
  { id: "grid", label: "网格", icon: Grid3x3 },
];

export type CanvasItemSource = "upload" | "generation";

/** 画布素材角色：参考套图 / 商品素材 / 生成成品 */
export type CanvasItemRole = "reference" | "product" | "output";

export interface CanvasItem {
  id: string;
  url: string;
  label?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isVideo: boolean;
  source?: CanvasItemSource;
  role?: CanvasItemRole;
  /** 已入库 assets.id，供套图生成 productAssetId / referenceAssetId */
  assetId?: string;
  /** 关联 message_outputs.id，供 AI 工具引用 */
  outputId?: string;
  /** 同一次生成 / 工具运行的批次，用于纵向历史流分组 */
  batchId?: string;
  /** 批次在时间线中的顺序，越大越新 */
  batchIndex?: number;
  batchTitle?: string;
  batchSubtitle?: string;
  parentBatchId?: string;
  sourceItemId?: string;
  locked?: boolean;
  generationParams?: {
    prompt: string;
    modelId?: string;
    resolution?: string;
    aspectRatio?: string;
    count?: number;
    toolType?: string;
    toolContext?: unknown;
  };
}

/** 工具/编辑 job 完成前登记，用于写入新批次的血缘 */
export type PendingBatchLineage = {
  parentBatchId?: string;
  sourceItemId: string;
  sourceOutputId?: string;
  toolName?: string;
};

export function pendingLineageToApiFields(lineage?: PendingBatchLineage): {
  parentJobId?: string;
  sourceOutputId?: string;
} {
  if (!lineage) return {};
  return {
    parentJobId: lineage.parentBatchId,
    sourceOutputId: lineage.sourceOutputId,
  };
}

/** 灵感套图条：从商品/参考/最近生成批解析血缘 */
export function resolveInspirationSetLineage(
  canvasItems: CanvasItem[],
  productItem?: CanvasItem | null,
  referenceItem?: CanvasItem | null,
): PendingBatchLineage | undefined {
  const fromItem = (item: CanvasItem, toolName: string): PendingBatchLineage => ({
    parentBatchId:
      item.batchId && item.batchId !== "uploads" ? item.batchId : undefined,
    sourceItemId: item.id,
    sourceOutputId: item.outputId,
    toolName,
  });

  if (productItem?.batchId && productItem.batchId !== "uploads") {
    return fromItem(productItem, "套图生成");
  }
  if (productItem?.outputId) {
    return fromItem(productItem, "套图生成");
  }
  if (referenceItem?.batchId && referenceItem.batchId !== "uploads") {
    return fromItem(referenceItem, "套图生成");
  }
  const latest = pickLatestBatchFocusTarget(canvasItems);
  if (latest) {
    const item = canvasItems.find((i) => i.id === latest.itemId);
    if (item?.batchId && item.batchId !== "uploads") {
      return fromItem(item, "套图生成");
    }
  }
  if (productItem) {
    return {
      sourceItemId: productItem.id,
      sourceOutputId: productItem.outputId,
      toolName: "套图生成",
    };
  }
  return undefined;
}

export function registerPendingBatchLineage(
  pending: Map<string, PendingBatchLineage>,
  jobId: string,
  lineage: PendingBatchLineage,
) {
  pending.set(jobId, lineage);
}

export function applyPendingBatchLineage(
  items: CanvasItem[],
  pending: Map<string, PendingBatchLineage>,
): CanvasItem[] {
  if (pending.size === 0) return items;
  const appliedJobIds = new Set<string>();
  const next = items.map((item) => {
    if (!item.batchId) return item;
    const lin = pending.get(item.batchId);
    if (!lin) return item;
    appliedJobIds.add(item.batchId);
    let batchTitle = item.batchTitle;
    if (
      lin.toolName &&
      (!batchTitle || !batchTitle.startsWith("精修 ·"))
    ) {
      batchTitle = `精修 · ${lin.toolName}`;
    }
    return {
      ...item,
      parentBatchId: item.parentBatchId ?? lin.parentBatchId,
      sourceItemId: item.sourceItemId ?? lin.sourceItemId,
      batchTitle,
    };
  });
  for (const jobId of appliedJobIds) pending.delete(jobId);
  return next;
}

/** 聚焦目标：生成批按 batchIndex 取最新，否则 uploads / 最后一项 */
export function pickLatestBatchFocusTarget(
  items: CanvasItem[],
): { batchId?: string; itemId: string } | null {
  if (!items.length) return null;

  const generation = items.filter(
    (i) =>
      i.batchId &&
      i.batchId !== "uploads" &&
      (i.source === "generation" || i.role === "output" || Boolean(i.outputId)),
  );
  if (generation.length) {
    let best = generation[0];
    for (const item of generation) {
      const idx = item.batchIndex ?? -1;
      const bestIdx = best.batchIndex ?? -1;
      if (idx > bestIdx || (idx === bestIdx && item.y > best.y)) {
        best = item;
      }
    }
    return { batchId: best.batchId, itemId: best.id };
  }

  const uploads = items.filter((i) => i.batchId === "uploads");
  if (uploads.length) {
    const last = uploads[uploads.length - 1]!;
    return { batchId: last.batchId, itemId: last.id };
  }

  const last = items[items.length - 1]!;
  return { batchId: last.batchId, itemId: last.id };
}

export function pickLatestBatchId(items: CanvasItem[]): string | null {
  return pickLatestBatchFocusTarget(items)?.batchId ?? null;
}

export function batchDisplayIndex(
  items: CanvasItem[],
  batchId: string,
): number | null {
  const item = items.find((i) => i.batchId === batchId);
  if (!item || item.batchIndex == null || item.batchIndex < 0) return null;
  return item.batchIndex + 1;
}

export function resolveSubmitBatchLineage(
  canvasItems: CanvasItem[],
  opts: {
    maskSelection?: CanvasMaskSelection | null;
    referenceOutputIds?: string[];
    toolName?: string;
  },
): PendingBatchLineage | undefined {
  if (opts.maskSelection) {
    const item = canvasItems.find((i) => i.id === opts.maskSelection!.itemId);
    if (item) {
      return {
        parentBatchId: item.batchId,
        sourceItemId: item.id,
        sourceOutputId: item.outputId,
        toolName: opts.toolName ?? opts.maskSelection.toolId,
      };
    }
  }
  const refId = opts.referenceOutputIds?.[0];
  if (refId) {
    const item = canvasItems.find(
      (i) => i.outputId === refId || i.id === refId,
    );
    if (item) {
      return {
        parentBatchId: item.batchId,
        sourceItemId: item.id,
        sourceOutputId: item.outputId ?? refId,
        toolName: opts.toolName,
      };
    }
  }
  return undefined;
}

export interface CanvasMaskSelection {
  id: string;
  itemId: string;
  toolId: string;
  mode: "brush" | "box";
  maskDataUrl: string;
  bbox: { x: number; y: number; width: number; height: number };
  normalizedBbox: { x: number; y: number; width: number; height: number };
}

export interface BatchSection {
  id: string;
  index: number;
  title: string;
  subtitle?: string;
  parentBatchId?: string;
  sourceItemId?: string;
  count: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

const CELL_W = 200;
const GAP = 16;
const BATCH_LEFT = 48;
const BATCH_TOP = 80;
const BATCH_GAP = 64;
const BATCH_TITLE_GAP = 48;
const BATCH_COLS = 4;

function truncateBatchTitle(value: string | undefined, fallback: string) {
  const text = value?.trim();
  if (!text) return fallback;
  return text.length > 30 ? `${text.slice(0, 30)}...` : text;
}

function resolveBatchTitle(
  msg: {
    generation_params?: CanvasItem["generationParams"];
  },
  lastUserPrompt: string,
  batchIndex: number,
): string {
  const toolType = msg.generation_params?.toolType;
  if (toolType) {
    const name = TOOL_DISPLAY_NAMES[toolType] ?? toolType;
    return `精修 · ${name}`;
  }
  const prompt = lastUserPrompt.trim();
  if (prompt) {
    return `生成 · ${truncateBatchTitle(prompt, `批次 ${batchIndex + 1}`)}`;
  }
  return truncateBatchTitle("", `批次 ${batchIndex + 1}`);
}

function formatBatchSubtitle(
  createdAt?: string,
  count?: number,
  imageProvider?: string,
) {
  const pieces: string[] = [];
  if (createdAt) {
    const date = new Date(createdAt);
    if (!Number.isNaN(date.getTime())) {
      pieces.push(
        date.toLocaleString("zh-CN", {
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    }
  }
  if (count) pieces.push(`${count} 张结果`);
  const providerLabel = formatToolProviderLabel(imageProvider);
  if (providerLabel) pieces.push(providerLabel);
  return pieces.join(" · ");
}

export function nextCanvasPosition(
  items: CanvasItem[],
  width = CELL_W,
  height = CELL_W,
): Pick<CanvasItem, "x" | "y" | "width" | "height"> {
  const cols = 3;
  const idx = items.length;
  const col = idx % cols;
  const row = Math.floor(idx / cols);
  return {
    x: 80 + col * (width + GAP),
    y: 80 + row * (height + GAP),
    width,
    height,
  };
}

export function buildCanvasItemsFromMessages(
  messages: {
    id: string;
    role?: "user" | "assistant" | "system";
    content?: string;
    job_id?: string | null;
    parent_job_id?: string | null;
    source_output_id?: string | null;
    created_at?: string;
    outputs: { id?: string; url: string; sort_order: number; label?: string }[];
    generation_params?: {
      prompt: string;
      modelId?: string;
      resolution?: string;
      aspectRatio?: string;
      toolType?: string;
      count?: number;
      imageProvider?: string;
    };
  }[],
): CanvasItem[] {
  const items: CanvasItem[] = [];
  let batchIndex = 0;
  let yCursor = BATCH_TOP;
  let lastUserPrompt = "";

  for (const msg of messages) {
    if (msg.role === "user") {
      lastUserPrompt = msg.content ?? "";
    }
    if (!msg.outputs?.length) continue;
    const batchId = msg.job_id ?? msg.id;
    const batchTitle = resolveBatchTitle(msg, lastUserPrompt, batchIndex);
    const batchSubtitle = formatBatchSubtitle(
      msg.created_at,
      msg.outputs.length,
      msg.generation_params?.imageProvider,
    );
    const rows = Math.ceil(msg.outputs.length / BATCH_COLS);

    msg.outputs.forEach((out, i) => {
      const col = i % BATCH_COLS;
      const row = Math.floor(i / BATCH_COLS);
      const isVideo =
        out.url.includes(".mp4") || out.url.includes("video");
      const height = isVideo ? Math.round(CELL_W * 0.56) : CELL_W;
      const fallbackLabel =
        msg.outputs.length === 4
          ? (["主图", "卖点", "场景", "详情"][i] as string | undefined)
          : undefined;
      items.push({
        id: out.id ?? `${msg.id}-${i}`,
        outputId: out.id,
        url: out.url,
        label: out.label ?? fallbackLabel,
        x: BATCH_LEFT + col * (CELL_W + GAP),
        y: yCursor + BATCH_TITLE_GAP + row * (CELL_W + GAP),
        width: CELL_W,
        height,
        isVideo,
        source: "generation",
        role: "output",
        batchId,
        batchIndex,
        batchTitle,
        batchSubtitle,
        parentBatchId: msg.parent_job_id ?? undefined,
        sourceItemId: msg.source_output_id ?? undefined,
        generationParams: msg.generation_params,
      });
    });
    yCursor += BATCH_TITLE_GAP + rows * CELL_W + Math.max(0, rows - 1) * GAP + BATCH_GAP;
    batchIndex += 1;
  }
  return items;
}

/** 保留已保存坐标，仅为新生成图追加布局 */
export function mergeCanvasItems(
  saved: CanvasItem[],
  incoming: CanvasItem[],
): CanvasItem[] {
  const incomingById = new Map(incoming.map((i) => [i.id, i]));
  const incomingByUrl = new Map(incoming.map((i) => [i.url, i]));
  const merged = saved.map((item) => {
    const match = incomingById.get(item.id) ?? incomingByUrl.get(item.url);
    if (!match) return item;
    const missingBatch = !item.batchId && match.batchId;
    return {
      ...item,
      outputId: item.outputId ?? match.outputId,
      batchId: item.batchId ?? match.batchId,
      batchIndex: item.batchIndex ?? match.batchIndex,
      batchTitle: item.batchTitle ?? match.batchTitle,
      batchSubtitle: item.batchSubtitle ?? match.batchSubtitle,
      parentBatchId: match.parentBatchId ?? item.parentBatchId,
      sourceItemId: match.sourceItemId ?? item.sourceItemId,
      ...(missingBatch
        ? { x: match.x, y: match.y, width: match.width, height: match.height }
        : {}),
    };
  });
  const urlSeen = new Set(merged.map((i) => i.url));
  const idSeen = new Set(merged.map((i) => i.id));

  for (const item of incoming) {
    if (urlSeen.has(item.url)) continue;
    let id = item.id;
    if (idSeen.has(id)) {
      id = `${item.id}-${randomUUID().slice(0, 8)}`;
    }
    merged.push({
      ...item,
      id,
      source: item.source ?? "generation",
    });
    urlSeen.add(item.url);
    idSeen.add(id);
  }
  return merged;
}

export function createUploadCanvasItem(
  url: string,
  items: CanvasItem[],
  options?: { assetId?: string; role?: CanvasItemRole; label?: string },
): CanvasItem {
  const uploadItems = items.filter((item) => item.batchId === "uploads");
  const pos = nextCanvasPosition(uploadItems);
  const role = options?.role ?? "product";
  return {
    id: `upload-${randomUUID()}`,
    url,
    assetId: options?.assetId,
    role,
    ...pos,
    isVideo: false,
    source: "upload",
    label: options?.label ?? (role === "product" ? "商品素材" : "上传"),
    batchId: "uploads",
    batchIndex: -1,
    batchTitle: "素材区",
    batchSubtitle: "上传与参考素材",
  };
}

export function createReferenceCanvasItem(
  url: string,
  items: CanvasItem[],
  assetId: string,
  index: number,
): CanvasItem {
  const item = createUploadCanvasItem(url, items, {
    assetId,
    role: "reference",
    label: index > 0 ? `套图参考 ${index + 1}` : "套图参考",
  });
  return item;
}

/** 精修链：解析 sourceItemId（可能是 canvas id 或 output id） */
export function resolveSourceCanvasItem(
  items: CanvasItem[],
  sourceItemId: string | undefined,
): CanvasItem | undefined {
  if (!sourceItemId) return undefined;
  return items.find(
    (i) => i.id === sourceItemId || i.outputId === sourceItemId,
  );
}

/** 收集从精修根图衍生的全部画布项（含根图） */
export function collectRefineChainItems(
  items: CanvasItem[],
  rootItemId: string,
): CanvasItem[] {
  const root = items.find((i) => i.id === rootItemId);
  if (!root) return [];

  const chainIds = new Set<string>([rootItemId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of items) {
      if (chainIds.has(item.id)) continue;
      const src = resolveSourceCanvasItem(items, item.sourceItemId);
      if (src && chainIds.has(src.id)) {
        chainIds.add(item.id);
        changed = true;
      }
    }
  }

  return [...chainIds]
    .map((id) => items.find((i) => i.id === id))
    .filter((i): i is CanvasItem => Boolean(i))
    .sort((a, b) => {
      const bi = a.batchIndex ?? 0;
      const bj = b.batchIndex ?? 0;
      if (bi !== bj) return bi - bj;
      return (a.label ?? a.id).localeCompare(b.label ?? b.id);
    });
}

/** 精修链上最新衍生图（不含根图） */
export function pickLatestChainDerivative(
  items: CanvasItem[],
  rootItemId: string,
): CanvasItem | null {
  const chain = collectRefineChainItems(items, rootItemId);
  const derivatives = chain.filter((i) => i.id !== rootItemId);
  if (!derivatives.length) return null;
  return derivatives.reduce((best, item) => {
    const idx = item.batchIndex ?? -1;
    const bestIdx = best.batchIndex ?? -1;
    if (idx > bestIdx) return item;
    if (idx === bestIdx && (item.y ?? 0) > (best.y ?? 0)) return item;
    return best;
  });
}

/** 单输出精修工具（适合 Before/After 对比） */
export const REFINE_SINGLE_OUTPUT_TOOL_IDS = new Set([
  "inpaint",
  "enhance",
  "upscale",
  "cutout",
  "erase",
  "expand",
  "text",
  "crop",
  "focus-edit",
]);

export function isSingleOutputRefineResult(
  items: CanvasItem[],
  item: CanvasItem,
): boolean {
  const siblings = items.filter(
    (i) =>
      i.id !== item.id &&
      i.batchId === item.batchId &&
      i.sourceItemId === item.sourceItemId,
  );
  return siblings.length === 0;
}

export function canShowRefineCompare(
  items: CanvasItem[],
  rootItemId: string,
  currentItemId: string,
): { before: CanvasItem; after: CanvasItem } | null {
  if (currentItemId === rootItemId) return null;
  const after = items.find((i) => i.id === currentItemId);
  if (!after || !isSingleOutputRefineResult(items, after)) return null;
  const before = resolveSourceCanvasItem(items, after.sourceItemId);
  if (!before) return null;
  return { before, after };
}
