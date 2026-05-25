export interface ImageModelMeta {
  id: string;
  name: string;
  description: string;
  type: "image" | "video";
  pointsFactor: number;
}

export const IMAGE_MODELS: ImageModelMeta[] = [
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

export function getModel(id: string): ImageModelMeta | undefined {
  return IMAGE_MODELS.find((m) => m.id === id);
}
