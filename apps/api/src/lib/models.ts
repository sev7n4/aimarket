export interface ModelMeta {
  id: string;
  name: string;
  description: string;
  type: "image" | "video";
  pointsFactor: number;
}

export const IMAGE_MODELS: ModelMeta[] = [
  {
    id: "omni-v2",
    name: "全能图片 V2",
    description: "顶尖图像生成模型，极致速度和超高性价比",
    type: "image",
    pointsFactor: 1,
  },
  {
    id: "latest-v2-pro",
    name: "最新图片 V2 Pro",
    description: "更稳定更快速，擅长各种复杂电商场景",
    type: "image",
    pointsFactor: 2,
  },
  {
    id: "seedream-5",
    name: "Seedream 5.0",
    description: "多角色超强一致性，中文处理能力极强",
    type: "image",
    pointsFactor: 1.5,
  },
];

export const VIDEO_MODELS: ModelMeta[] = [
  {
    id: "seedance-2",
    name: "Seedance 2.0",
    description: "目前最强视频模型，给你如导演般的掌控权",
    type: "video",
    pointsFactor: 3,
  },
  {
    id: "wan-2.6",
    name: "万相 2.6",
    description: "支持角色扮演视频生成，功能全面，画质音效出色",
    type: "video",
    pointsFactor: 2.5,
  },
];

export const ALL_MODELS = [...IMAGE_MODELS, ...VIDEO_MODELS];

export function getModel(id: string): ModelMeta | undefined {
  return ALL_MODELS.find((m) => m.id === id);
}
