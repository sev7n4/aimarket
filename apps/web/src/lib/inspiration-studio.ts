import type { AspectRatio } from "@/components/generation-settings-popover";
import type { CreationLane } from "@/lib/creation-dock-prefs";
import { persistCreationLane } from "@/lib/creation-dock-prefs";
import type { DramaTemplateMetadata, InspirationDetail } from "@/lib/types";
import { registerAssetFromUrl } from "@/lib/api/assets";
import { buildProductionStudioUrl, buildStudioUrl } from "@/lib/studio-navigation";
import {
  createReferenceCanvasItem,
  type CanvasItem,
} from "@/lib/canvas-tools";
import { storePendingInspiration } from "@/lib/pending-inspiration";
import { storePendingAssets } from "@/lib/pending-assets";
import { clientNavigate } from "@/lib/client-navigate";
import { randomUUID } from "@/lib/uuid";

type StudioRouter = {
  push: (href: string) => void;
};

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
  /** 做同款进入 Studio 时预选创作车道 */
  creationLane: CreationLane;
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

const VIDEO_COVER_RE = /\.(mp4|webm|mov)(\?|$)/i;

export function isVideoCoverUrl(url: string): boolean {
  return VIDEO_COVER_RE.test(url);
}

/** 灵感素材类型 → Studio 创作车道（图片 / 视频） */
export function resolveInspirationCreationLane(
  detail: Pick<
    InspirationDetail,
    "modelId" | "mediaType" | "coverUrl" | "referenceAssets"
  >,
): CreationLane {
  if (detail.mediaType === "video") return "video";
  if (detail.mediaType === "image") return "image";
  const cover = detail.coverUrl ?? detail.referenceAssets[0]?.url ?? "";
  if (isVideoCoverUrl(cover)) return "video";
  return "image";
}

/** 图片灵感走电商套图 Project；视频灵感走画布 + 视频车道 */
export function buildInspirationStudioUrl(
  detail: Pick<
    InspirationDetail,
    "id" | "title" | "prompt" | "modelId" | "mediaType" | "coverUrl" | "referenceAssets"
  >,
  sessionId: string,
): string {
  const lane = resolveInspirationCreationLane(detail);
  if (lane === "video") {
    return buildStudioUrl("canvas", {
      sessionId,
      mode: "image",
      title: detail.title,
      prompt: detail.prompt,
      inspirationId: detail.id,
    });
  }
  return buildStudioUrl("project", {
    sessionId,
    mode: "ecommerce",
    title: detail.title,
    prompt: detail.prompt,
    inspirationId: detail.id,
  });
}

export function buildPendingInspirationPayload(
  detail: InspirationDetail,
  variableValues: Record<string, string> = {},
): Omit<StudioInspirationApply, "applyKey"> {
  const referenceUrls = detail.referenceAssets.map((a) => a.url);
  const creationLane = resolveInspirationCreationLane(detail);
  return {
    id: detail.id,
    title: detail.title,
    prompt: detail.prompt,
    promptTemplate: detail.promptTemplate,
    variables: detail.variables?.map((v) => ({
      ...v,
      default: variableValues[v.key] ?? v.default,
    })),
    modelId: detail.modelId,
    aspectRatio: coerceInspirationAspect(detail.aspectRatio),
    resolution: detail.resolution,
    referenceUrls,
    variableValues,
    creationLane,
  };
}

/** 写入 sessionStorage 并跳转 Studio（扇形 / 画廊做同款共用） */
export function applyInspirationToStudio(
  detail: InspirationDetail,
  router: StudioRouter,
  opts?: { sessionId?: string; variableValues?: Record<string, string> },
) {
  const sessionId = opts?.sessionId ?? randomUUID();
  const payload = buildPendingInspirationPayload(
    detail,
    opts?.variableValues,
  );
  persistCreationLane("studio", payload.creationLane);
  storePendingInspiration(sessionId, payload);
  if (payload.referenceUrls.length > 0) {
    storePendingAssets(
      sessionId,
      payload.referenceUrls.map((url, i) => ({
        id: `insp-ref-${i}`,
        url,
      })),
    );
  }
  clientNavigate(router, buildInspirationStudioUrl(detail, sessionId));
  return sessionId;
}

/** 制片模板：跳转 production Studio 并预填 Dock（PROD-B06） */
export function applyDramaTemplateToStudio(
  detail: Pick<InspirationDetail, "id" | "title" | "dramaTemplate">,
  router: StudioRouter,
  opts: { sessionId: string; dramaTemplate: DramaTemplateMetadata },
) {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(
      `aimarket_pending_drama_template_${opts.sessionId}`,
      JSON.stringify({
        inspirationId: detail.id,
        title: detail.title,
        ...opts.dramaTemplate,
      }),
    );
  }
  clientNavigate(
    router,
    buildProductionStudioUrl({
      sessionId: opts.sessionId,
      title: detail.title,
      prompt: opts.dramaTemplate.userIdea,
      inspirationId: detail.id,
      newDraft: false,
    }),
  );
  return opts.sessionId;
}

export function consumePendingDramaTemplate(
  sessionId: string,
): (DramaTemplateMetadata & { inspirationId?: string; title?: string }) | null {
  if (typeof sessionStorage === "undefined") return null;
  const key = `aimarket_pending_drama_template_${sessionId}`;
  const raw = sessionStorage.getItem(key);
  if (!raw) return null;
  sessionStorage.removeItem(key);
  try {
    return JSON.parse(raw) as DramaTemplateMetadata & {
      inspirationId?: string;
      title?: string;
    };
  } catch {
    return null;
  }
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
