export interface ModelMeta {
  id: string;
  name: string;
  description: string;
  type: "image" | "video";
  pointsFactor: number;
}

export const IMAGE_MODELS: ModelMeta[] = [
  {
    id: "seedream-5",
    name: "Seedream 5",
    description: "ByteDance · doubao-seedream-5-0-260128",
    type: "image",
    pointsFactor: 1.5,
  },
  {
    id: "wanxiang-2.6",
    name: "Wanxiang 2.6",
    description: "Alibaba · wan2.6-t2i",
    type: "image",
    pointsFactor: 1,
  },
  {
    id: "agnes-image",
    name: "Agnes Image 2.1",
    description: "Agnes · agnes-image-2.1-flash",
    type: "image",
    pointsFactor: 1.2,
  },
];

export const VIDEO_MODELS: ModelMeta[] = [
  {
    id: "seedance-2",
    name: "Seedance 2",
    description: "ByteDance · Seedance 2",
    type: "video",
    pointsFactor: 3,
  },
  {
    id: "wan-2.6",
    name: "Wanxiang 2.6",
    description: "Alibaba · Wanxiang 2.6",
    type: "video",
    pointsFactor: 2.5,
  },
  {
    id: "agnes-video",
    name: "Agnes Video 2.0",
    description: "Agnes · agnes-video-v2.0",
    type: "video",
    pointsFactor: 3,
  },
];

/** z.enum 用：与 VIDEO_MODELS 保持同步，避免接口白名单漏项 */
export const VIDEO_MODEL_IDS = VIDEO_MODELS.map((m) => m.id) as [
  (typeof VIDEO_MODELS)[number]["id"],
  ...(typeof VIDEO_MODELS)[number]["id"][],
];

export {
  INTERNAL_ROUTING_MODEL_IDS as INTERNAL_ROUTING_IDS,
  isInternalRoutingModelId,
  type GenerationQualityTier,
  type GenerationRoutingMode,
} from "./generation-routing.js";

export const ALL_MODELS = [...IMAGE_MODELS, ...VIDEO_MODELS];

export function getModel(id: string): ModelMeta | undefined {
  const seedream5 = IMAGE_MODELS.find((m) => m.id === "seedream-5");
  // Internal aliases: preserve legacy pricing for tool defaults & old jobs
  if (id === "omni-v2" && seedream5) {
    return { ...seedream5, id: "omni-v2", pointsFactor: 1 };
  }
  if (id === "latest-v2-pro" && seedream5) {
    return { ...seedream5, id: "latest-v2-pro", pointsFactor: 2 };
  }
  return ALL_MODELS.find((m) => m.id === id);
}
