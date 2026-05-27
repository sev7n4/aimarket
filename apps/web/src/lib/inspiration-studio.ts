import type { AspectRatio } from "@/components/generation-settings-popover";
import type { InspirationDetail } from "@/lib/types";
import { registerAssetFromUrl } from "@/lib/api-client";
import { buildStudioUrl } from "@/lib/studio-navigation";
import {
  createReferenceCanvasItem,
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

/** 灵感做同款统一进入电商套图 Project 工作流 */
export function buildInspirationStudioUrl(
  detail: InspirationDetail,
  sessionId: string,
): string {
  return buildStudioUrl("project", {
    sessionId,
    mode: "ecommerce",
    title: detail.title,
    prompt: detail.prompt,
    inspirationId: detail.id,
  });
}

/** 灵感参考图入库并生成画布 item（role=reference） */
export async function importInspirationReferencesToCanvas(
  sessionId: string,
  urls: string[],
): Promise<CanvasItem[]> {
  const items: CanvasItem[] = [];
  for (let i = 0; i < urls.length; i += 1) {
    const url = urls[i];
    if (!url) continue;
    const asset = await registerAssetFromUrl({
      sessionId,
      url,
      fileName: `inspiration-ref-${i + 1}.jpg`,
    });
    items.push(createReferenceCanvasItem(asset.url, items, asset.id, i));
  }
  return items;
}
