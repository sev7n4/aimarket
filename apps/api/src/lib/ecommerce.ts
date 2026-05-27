export interface EcommerceBrief {
  brand?: string;
  platform: string;
  market: string;
  language: string;
  productInfo: string;
  designer?: string;
  productAssetId?: string;
  referenceAssetId?: string;
}

export const ECOMMERCE_SLIDE_KEYS = [
  "main",
  "selling",
  "scene",
  "detail",
] as const;

export type EcommerceSlideKey = (typeof ECOMMERCE_SLIDE_KEYS)[number];

export const ECOMMERCE_SLIDES: ReadonlyArray<{
  key: EcommerceSlideKey;
  label: string;
}> = [
  { key: "main", label: "电商主图" },
  { key: "selling", label: "卖点海报" },
  { key: "scene", label: "场景展示图" },
  { key: "detail", label: "详情页头图" },
] as const;

export function getEcommerceSlideLabel(key: EcommerceSlideKey): string {
  const slide = ECOMMERCE_SLIDES.find((item) => item.key === key);
  return slide?.label ?? "电商主图";
}

export function buildEcommercePrompt(brief: EcommerceBrief): string {
  const parts = [
    `【电商套图】平台：${brief.platform}，市场：${brief.market}，语言：${brief.language}`,
    brief.brand ? `品牌：${brief.brand}` : null,
    brief.designer ? `设计师风格：${brief.designer}` : null,
    `产品信息：${brief.productInfo}`,
    "请按电商转化逻辑生成高点击率商业摄影风格素材。",
  ].filter(Boolean);

  return parts.join("\n");
}
