/**
 * 首页扇形灵感套图：展示层元数据 + API 不可用时的静态 fallback。
 * 封面 / prompt / 模型等与 API inspiration_templates（inspiration-seed.ts）保持一致。
 */

export type ApparelFanCategoryId = "apparel" | "ecommerce" | "marketing";

export interface ApparelFanCategory {
  id: ApparelFanCategoryId;
  label: string;
  description: string;
  available: boolean;
}

export interface ApparelFanItem {
  id: string;
  title: string;
  category: "服饰";
  coverUrl: string;
  prompt: string;
  modelId: string;
  aspectRatio: "1:1" | "3:4" | "2:3" | "4:5" | "16:9";
  resolution: "1k" | "2k" | "4k";
  subtitle: string;
  tools: string[];
}

/** 与 apps/api/src/db/inspiration-seed.ts cover() 中 apparel-* 键一致 */
const COVERS = {
  tryon:
    "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=520&h=700&fit=crop&q=90",
  white:
    "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=520&h=520&fit=crop&q=90",
  street:
    "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=520&h=700&fit=crop&q=90",
  selling:
    "https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=520&h=700&fit=crop&q=90",
  colorways:
    "https://images.unsplash.com/photo-1558171813-4c088753af8f?w=520&h=520&fit=crop&q=90",
  detail:
    "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=520&h=700&fit=crop&q=90",
  video:
    "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=520&h=700&fit=crop&q=90",
} as const;

export const APPAREL_FAN_CATEGORIES: ApparelFanCategory[] = [
  {
    id: "apparel",
    label: "服装",
    description: "模特换衣 / 白底 / 场景种草 / 卖点 / 多色 / 细节 / 短视频",
    available: true,
  },
  {
    id: "ecommerce",
    label: "通用电商",
    description: "敬请期待：3C / 美妆 / 家居等品类的高频套图",
    available: false,
  },
  {
    id: "marketing",
    label: "营销海报",
    description: "敬请期待：节日营销 / 投放素材 / 多语言海报",
    available: false,
  },
];

export const APPAREL_FAN_ITEMS: ApparelFanItem[] = [
  {
    id: "apparel-tryon-main",
    title: "模特换衣主图",
    category: "服饰",
    subtitle: "上传平铺图 + 模特图，自动换衣输出主图",
    tools: ["Agent 串联", "局部重绘", "细节增强"],
    prompt:
      "时尚模特穿搭摄影，模特身着服装，自然姿态，专业摄影光感，高质感电商主图风格，背景简洁高级，突出服装版型与面料质感。",
    coverUrl: COVERS.tryon,
    aspectRatio: "3:4",
    modelId: "latest-v2-pro",
    resolution: "2k",
  },
  {
    id: "apparel-white-bg",
    title: "白底标准图",
    category: "服饰",
    subtitle: "上传服装图，自动抠图并输出平台合规白底",
    tools: ["抠图", "擦除", "超分"],
    prompt:
      "服装产品白底摄影图，纯白背景，服装主体居中，边缘干净清晰，颜色还原准确，符合电商平台主图规范，专业商业摄影质感。",
    coverUrl: COVERS.white,
    aspectRatio: "1:1",
    modelId: "latest-v2-pro",
    resolution: "2k",
  },
  {
    id: "apparel-street-scene",
    title: "场景种草图",
    category: "服饰",
    subtitle: "都市通勤 / 街拍场景，突出上身效果",
    tools: ["扩图", "场景重绘", "细节增强"],
    prompt:
      "都市街拍时尚穿搭图，模特在城市街道场景中，自然光，轻松姿态，突出版型与上身效果，适合种草营销的高质感街拍风格。",
    coverUrl: COVERS.street,
    aspectRatio: "3:4",
    modelId: "latest-v2-pro",
    resolution: "2k",
  },
  {
    id: "apparel-selling-poster",
    title: "卖点信息图",
    category: "服饰",
    subtitle: "面料 / 版型 / 工艺三段式卖点海报",
    tools: ["文本工具", "局部重绘", "细节增强"],
    prompt:
      "服装卖点营销海报，时尚摄影风格，突出面料质感、版型设计、工艺细节，留出文字信息区，信息层级清晰，适合电商详情页展示。",
    coverUrl: COVERS.selling,
    aspectRatio: "3:4",
    modelId: "omni-v2",
    resolution: "2k",
  },
  {
    id: "apparel-colorways",
    title: "多色多款展示图",
    category: "服饰",
    subtitle: "一键生成 SKU 多色 / 多花型展示",
    tools: ["Agent 串联", "局部重绘", "拼图融合"],
    prompt:
      "服装多色展示图，同一款式展示 3-5 个不同颜色版本，保持款式结构完全一致，专业产品摄影风格，适合 SKU 多色展示与选款。",
    coverUrl: COVERS.colorways,
    aspectRatio: "1:1",
    modelId: "latest-v2-pro",
    resolution: "2k",
  },
  {
    id: "apparel-detail-closeup",
    title: "细节特写图",
    category: "服饰",
    subtitle: "领口 / 走线 / 面料纹理商业摄影感",
    tools: ["扩图", "细节增强", "超分"],
    prompt:
      "服装细节特写摄影，突出领口、袖口、走线与面料纹理，专业商业摄影光感，高清晰度展示工艺细节，适合详情页卖点展示。",
    coverUrl: COVERS.detail,
    aspectRatio: "3:4",
    modelId: "latest-v2-pro",
    resolution: "4k",
  },
  {
    id: "apparel-promo-video",
    title: "短视频封面套图",
    category: "服饰",
    subtitle: "为短视频准备统一风格的主图 / 封面",
    tools: ["主图重绘", "扩图", "细节增强"],
    prompt:
      "时尚短视频封面风格套图，模特身着服装，动态姿态，视觉冲击力强，风格统一，适合短视频投放与详情页主图展示。",
    coverUrl: COVERS.video,
    aspectRatio: "3:4",
    modelId: "latest-v2-pro",
    resolution: "2k",
  },
];

const FAN_META_BY_ID = Object.fromEntries(
  APPAREL_FAN_ITEMS.map((item) => [
    item.id,
    { subtitle: item.subtitle, tools: item.tools },
  ]),
) as Record<string, { subtitle: string; tools: string[] }>;

export function getApparelFanMeta(id: string) {
  return FAN_META_BY_ID[id];
}

export function listApparelFanStaticFallback(): ApparelFanItem[] {
  return APPAREL_FAN_ITEMS;
}
