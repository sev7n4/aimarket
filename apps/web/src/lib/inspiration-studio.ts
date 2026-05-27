import type { AspectRatio } from "@/components/generation-settings-popover";
import type { InspirationDetail } from "@/lib/types";
import { buildStudioUrl, type StudioKind } from "@/lib/studio-navigation";
import {
  createUploadCanvasItem,
  type CanvasItem,
} from "@/lib/canvas-tools";

export interface InspirationVariable {
  key: string;
  label: string;
  default: string;
}

/** Studio 工作台灌入用的同款 payload */
export interface StudioInspirationApply {
  id: string;
  title: string;
  prompt: string;
  promptTemplate?: string;
  variables?: InspirationVariable[];
  modelId: string;
  aspectRatio: AspectRatio;
  resolution: string;
  referenceUrls: string[];
  variableValues: Record<string, string>;
  applyKey: number;
}

const ASPECT_RATIOS: AspectRatio[] = [
  "1:1",
  "4:3",
  "3:4",
  "16:9",
  "9:16",
  "3:2",
  "2:3",
  "4:5",
  "5:4",
  "21:9",
];

export function coerceInspirationAspect(value: string): AspectRatio {
  if (value === "auto" || !value) return "1:1";
  return ASPECT_RATIOS.includes(value as AspectRatio) ?
      (value as AspectRatio)
    : "1:1";
}

/** 套图类模板自动归档为 project，其余为 canvas */
export function resolveInspirationSessionKind(
  detail: Pick<InspirationDetail, "category" | "title">,
): StudioKind {
  const text = `${detail.category}${detail.title}`;
  if (text.includes("套图")) return "project";
  return "canvas";
}

export function buildInspirationStudioUrl(
  detail: InspirationDetail,
  sessionId: string,
): string {
  const kind = resolveInspirationSessionKind(detail);
  return buildStudioUrl(kind, {
    sessionId,
    mode: "chat",
    title: detail.title,
    prompt: detail.prompt,
    inspirationId: detail.id,
  });
}

export function buildCanvasItemsFromReferenceUrls(
  urls: string[],
): CanvasItem[] {
  const items: CanvasItem[] = [];
  for (let i = 0; i < urls.length; i += 1) {
    const url = urls[i];
    if (!url) continue;
    const item = createUploadCanvasItem(url, items);
    items.push({
      ...item,
      label:
        urls.length > 1 ? `参考 ${i + 1}` : "参考图",
    });
  }
  return items;
}
