import { APPAREL_FAN_ITEMS } from "./inspiration-apparel-fan";

export type InspirationCategory =
  | "全部"
  | "电商"
  | "服饰"
  | "营销"
  | "新媒体"
  | "人像"
  | "修复"
  | "创意";

export interface InspirationItem {
  id: string;
  title: string;
  category: Exclude<InspirationCategory, "全部">;
  aspect: "portrait" | "landscape" | "square";
  prompt: string;
  coverUrl: string;
}

function cover(seed: string, w: number, h: number) {
  return `https://picsum.photos/seed/aimarket-${seed}/${w}/${h}`;
}

export const inspirationCategories: InspirationCategory[] = [
  "全部",
  "电商",
  "服饰",
  "营销",
  "新媒体",
  "人像",
  "修复",
  "创意",
];

export const inspirationItems: InspirationItem[] = [
  {
    id: "product-photo",
    title: "产品摄影图",
    category: "电商",
    aspect: "portrait",
    prompt: "将产品放在大理石台面上，柔和侧光，商业摄影质感",
    coverUrl: cover("product-photo", 480, 640),
  },
  {
    id: "virtual-tryon",
    title: "虚拟试衣",
    category: "服饰",
    aspect: "portrait",
    prompt: "让模特穿上这件外套，自然站姿，街拍风格",
    coverUrl: cover("tryon", 480, 640),
  },
  {
    id: "poster",
    title: "商品海报图制作",
    category: "营销",
    aspect: "landscape",
    prompt: "制作促销海报，突出新品上市与限时折扣",
    coverUrl: cover("poster", 640, 420),
  },
  {
    id: "social",
    title: "社媒配图",
    category: "新媒体",
    aspect: "square",
    prompt: "小红书风格封面，标题醒目，清新配色",
    coverUrl: cover("social", 520, 520),
  },
  {
    id: "detail",
    title: "电商详情图",
    category: "电商",
    aspect: "portrait",
    prompt: "生成详情页卖点模块，突出核心功能与材质",
    coverUrl: cover("detail", 480, 640),
  },
  {
    id: "surreal",
    title: "超现实产品海报",
    category: "创意",
    aspect: "landscape",
    prompt: "超现实场景，产品悬浮，霓虹光效",
    coverUrl: cover("surreal", 640, 400),
  },
  {
    id: "tea-poster",
    title: "茶饮新品海报",
    category: "营销",
    aspect: "portrait",
    prompt: "茶饮新品上市海报，清新绿色调，大字标题",
    coverUrl: cover("tea", 480, 640),
  },
  {
    id: "render",
    title: "产品效果图",
    category: "电商",
    aspect: "square",
    prompt: "3D 渲染风格产品效果图，科技感背景",
    coverUrl: cover("render", 520, 520),
  },
  {
    id: "print-poster",
    title: "印刷海报",
    category: "营销",
    aspect: "landscape",
    prompt: "线下印刷海报，高对比排版，品牌色统一",
    coverUrl: cover("print", 640, 420),
  },
  {
    id: "wiki",
    title: "科普百科图",
    category: "创意",
    aspect: "landscape",
    prompt: "科普信息图风格，分步骤图解，扁平插画",
    coverUrl: cover("wiki", 640, 400),
  },
  {
    id: "city-poster",
    title: "城市海报",
    category: "创意",
    aspect: "portrait",
    prompt: "城市文旅宣传海报，夜景与地标结合",
    coverUrl: cover("city", 480, 640),
  },
  {
    id: "biz-poster",
    title: "商业海报",
    category: "营销",
    aspect: "portrait",
    prompt: "商务活动主视觉，稳重蓝金配色",
    coverUrl: cover("biz", 480, 640),
  },
  {
    id: "handheld",
    title: "手持商品图",
    category: "电商",
    aspect: "square",
    prompt: "模特手持商品展示，生活场景，自然光",
    coverUrl: cover("hand", 520, 520),
  },
  {
    id: "movie-poster",
    title: "影视海报",
    category: "创意",
    aspect: "portrait",
    prompt: "电影海报风格，戏剧光影，人物特写",
    coverUrl: cover("movie", 480, 640),
  },
  {
    id: "onboard",
    title: "入驻海报",
    category: "营销",
    aspect: "landscape",
    prompt: "平台入驻宣传图，突出权益与流程",
    coverUrl: cover("onboard", 640, 400),
  },
  {
    id: "promo",
    title: "商品宣传图",
    category: "电商",
    aspect: "square",
    prompt: "商品多角度宣传拼图，统一背景",
    coverUrl: cover("promo", 520, 520),
  },
  {
    id: "selling",
    title: "卖点海报",
    category: "营销",
    aspect: "portrait",
    prompt: "三卖点竖版海报，图标+短文案",
    coverUrl: cover("sell", 480, 640),
  },
  {
    id: "white-bg",
    title: "产品精修白底图",
    category: "电商",
    aspect: "square",
    prompt: "抠图并生成纯白底商品主图，边缘干净",
    coverUrl: cover("white", 520, 520),
  },
  {
    id: "id-photo",
    title: "美式证件照",
    category: "人像",
    aspect: "portrait",
    prompt: "美式证件照风格，背景纯色，光线均匀",
    coverUrl: cover("id", 480, 640),
  },
  {
    id: "burger",
    title: "汉堡广告海报",
    category: "营销",
    aspect: "landscape",
    prompt: "快餐汉堡广告，食欲感构图，暖色调",
    coverUrl: cover("burger", 640, 420),
  },
  {
    id: "retouch",
    title: "产品精修",
    category: "电商",
    aspect: "square",
    prompt: "产品精修，去瑕疵，增强质感与锐度",
    coverUrl: cover("retouch", 520, 520),
  },
  {
    id: "creative-product",
    title: "创意产品图",
    category: "创意",
    aspect: "landscape",
    prompt: "创意合成产品场景，节日主题",
    coverUrl: cover("creative", 640, 400),
  },
  {
    id: "main-image",
    title: "电商主图",
    category: "电商",
    aspect: "square",
    prompt: "淘宝主图风格，产品居中，干净背景",
    coverUrl: cover("main", 520, 520),
  },
  {
    id: "steps",
    title: "步骤讲解图",
    category: "新媒体",
    aspect: "landscape",
    prompt: "教程步骤图，编号清晰，扁平风格",
    coverUrl: cover("steps", 640, 400),
  },
  {
    id: "storyboard",
    title: "影视分镜",
    category: "创意",
    aspect: "landscape",
    prompt: "电影分镜风格，戏剧光影，宽画幅",
    coverUrl: cover("story", 640, 400),
  },
  {
    id: "xhs",
    title: "小红书海报",
    category: "新媒体",
    aspect: "portrait",
    prompt: "小红书竖版海报，大字标题，生活感构图",
    coverUrl: cover("xhs", 480, 640),
  },
  {
    id: "restore",
    title: "照片修复上色",
    category: "修复",
    aspect: "landscape",
    prompt: "修复老照片划痕并自然上色",
    coverUrl: cover("restore", 640, 420),
  },
  ...APPAREL_FAN_ITEMS.map((item) => ({
    id: item.id,
    title: item.title,
    category: item.category,
    aspect:
      item.aspectRatio === "1:1"
        ? ("square" as const)
        : item.aspectRatio === "16:9"
          ? ("landscape" as const)
          : ("portrait" as const),
    prompt: item.prompt,
    coverUrl: item.coverUrl,
  })),
];
