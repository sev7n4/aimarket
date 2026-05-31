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
];

/**
 * omni-v2 / latest-v2-pro are internal routing aliases used by Auto mode.
 * They are NOT exposed to the user-facing model list.
 */
export const INTERNAL_ROUTING_IDS = new Set(["omni-v2", "latest-v2-pro"]);

export const ALL_MODELS = [...IMAGE_MODELS, ...VIDEO_MODELS];

export function getModel(id: string): ModelMeta | undefined {
  // Also resolve internal aliases so job records still get a name
  if (id === "omni-v2" || id === "latest-v2-pro") {
    return IMAGE_MODELS.find((m) => m.id === "seedream-5");
  }
  return ALL_MODELS.find((m) => m.id === id);
}
