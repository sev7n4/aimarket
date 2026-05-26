import { db } from "./index.js";

type SeedItem = {
  id: string;
  legacyId: number;
  title: string;
  category: string;
  promptTemplate: string;
  modelId: string;
  aspectRatio: string;
  resolution: string;
  coverUrl: string;
  variables?: Array<{ key: string; label: string; default: string }>;
  referenceUrls?: string[];
};

function cover(seed: string, w: number, h: number) {
  return `https://picsum.photos/seed/aimarket-${seed}/${w}/${h}`;
}

const SEED_ITEMS: SeedItem[] = [
  {
    id: "product-photo",
    legacyId: 1,
    title: "产品摄影图",
    category: "电商",
    promptTemplate:
      "将{{product}}放在大理石台面上，柔和侧光，商业摄影质感，专业电商主图",
    modelId: "latest-v2-pro",
    aspectRatio: "2:3",
    resolution: "2k",
    coverUrl: cover("product-photo", 480, 640),
    variables: [{ key: "product", label: "产品", default: "护肤品" }],
  },
  {
    id: "virtual-tryon",
    legacyId: 2,
    title: "虚拟试衣",
    category: "服饰",
    promptTemplate: "让模特穿上这件外套，自然站姿，街拍风格，时尚服饰展示",
    modelId: "latest-v2-pro",
    aspectRatio: "2:3",
    resolution: "2k",
    coverUrl: cover("tryon", 480, 640),
  },
  {
    id: "poster",
    legacyId: 3,
    title: "商品海报图制作",
    category: "营销",
    promptTemplate: "制作促销海报，突出新品上市与限时折扣，视觉冲击力强",
    modelId: "omni-v2",
    aspectRatio: "16:9",
    resolution: "2k",
    coverUrl: cover("poster", 640, 420),
  },
  {
    id: "social",
    legacyId: 4,
    title: "社媒配图",
    category: "新媒体",
    promptTemplate: "小红书风格封面，标题醒目，清新配色，适合社交媒体传播",
    modelId: "omni-v2",
    aspectRatio: "1:1",
    resolution: "1k",
    coverUrl: cover("social", 520, 520),
  },
  {
    id: "detail",
    legacyId: 5,
    title: "电商详情图",
    category: "电商",
    promptTemplate: "生成详情页卖点模块，突出核心功能与材质，信息层次清晰",
    modelId: "latest-v2-pro",
    aspectRatio: "2:3",
    resolution: "2k",
    coverUrl: cover("detail", 480, 640),
  },
  {
    id: "surreal",
    legacyId: 6,
    title: "超现实产品海报",
    category: "创意",
    promptTemplate: "超现实场景，产品悬浮，霓虹光效，创意广告视觉",
    modelId: "seedream-5",
    aspectRatio: "16:9",
    resolution: "2k",
    coverUrl: cover("surreal", 640, 400),
  },
  {
    id: "tea-poster",
    legacyId: 7,
    title: "茶饮新品海报",
    category: "营销",
    promptTemplate: "茶饮新品上市海报，清新绿色调，大字标题，食欲感构图",
    modelId: "omni-v2",
    aspectRatio: "2:3",
    resolution: "2k",
    coverUrl: cover("tea", 480, 640),
  },
  {
    id: "render",
    legacyId: 8,
    title: "产品效果图",
    category: "电商",
    promptTemplate: "3D 渲染风格产品效果图，科技感背景，高精度材质",
    modelId: "latest-v2-pro",
    aspectRatio: "1:1",
    resolution: "2k",
    coverUrl: cover("render", 520, 520),
  },
  {
    id: "print-poster",
    legacyId: 9,
    title: "印刷海报",
    category: "营销",
    promptTemplate: "线下印刷海报，高对比排版，品牌色统一，适合大幅面输出",
    modelId: "omni-v2",
    aspectRatio: "16:9",
    resolution: "4k",
    coverUrl: cover("print", 640, 420),
  },
  {
    id: "wiki",
    legacyId: 10,
    title: "科普百科图",
    category: "创意",
    promptTemplate: "科普信息图风格，分步骤图解，扁平插画，易于理解",
    modelId: "omni-v2",
    aspectRatio: "16:9",
    resolution: "1k",
    coverUrl: cover("wiki", 640, 400),
  },
  {
    id: "city-poster",
    legacyId: 11,
    title: "城市海报",
    category: "创意",
    promptTemplate: "城市文旅宣传海报，夜景与地标结合，电影感色调",
    modelId: "seedream-5",
    aspectRatio: "2:3",
    resolution: "2k",
    coverUrl: cover("city", 480, 640),
  },
  {
    id: "biz-poster",
    legacyId: 12,
    title: "商业海报",
    category: "营销",
    promptTemplate: "商务活动主视觉，稳重蓝金配色，专业可信",
    modelId: "omni-v2",
    aspectRatio: "2:3",
    resolution: "2k",
    coverUrl: cover("biz", 480, 640),
  },
  {
    id: "handheld",
    legacyId: 13,
    title: "手持商品图",
    category: "电商",
    promptTemplate: "模特手持商品展示，生活场景，自然光，真实感",
    modelId: "latest-v2-pro",
    aspectRatio: "1:1",
    resolution: "2k",
    coverUrl: cover("hand", 520, 520),
  },
  {
    id: "movie-poster",
    legacyId: 14,
    title: "影视海报",
    category: "创意",
    promptTemplate: "电影海报风格，戏剧光影，人物特写，宽画幅构图",
    modelId: "seedream-5",
    aspectRatio: "2:3",
    resolution: "2k",
    coverUrl: cover("movie", 480, 640),
  },
  {
    id: "onboard",
    legacyId: 15,
    title: "入驻海报",
    category: "营销",
    promptTemplate: "平台入驻宣传图，突出权益与流程，信息架构清晰",
    modelId: "omni-v2",
    aspectRatio: "16:9",
    resolution: "1k",
    coverUrl: cover("onboard", 640, 400),
  },
  {
    id: "promo",
    legacyId: 16,
    title: "商品宣传图",
    category: "电商",
    promptTemplate: "商品多角度宣传拼图，统一背景，电商详情风格",
    modelId: "latest-v2-pro",
    aspectRatio: "1:1",
    resolution: "2k",
    coverUrl: cover("promo", 520, 520),
  },
  {
    id: "selling",
    legacyId: 17,
    title: "卖点海报",
    category: "营销",
    promptTemplate: "三卖点竖版海报，图标+短文案，转化导向",
    modelId: "omni-v2",
    aspectRatio: "2:3",
    resolution: "2k",
    coverUrl: cover("sell", 480, 640),
  },
  {
    id: "white-bg",
    legacyId: 18,
    title: "产品精修白底图",
    category: "电商",
    promptTemplate: "抠图并生成纯白底商品主图，边缘干净，适合平台主图",
    modelId: "latest-v2-pro",
    aspectRatio: "1:1",
    resolution: "2k",
    coverUrl: cover("white", 520, 520),
  },
  {
    id: "id-photo",
    legacyId: 19,
    title: "美式证件照",
    category: "人像",
    promptTemplate: "美式证件照风格，背景纯色，光线均匀，五官清晰",
    modelId: "omni-v2",
    aspectRatio: "2:3",
    resolution: "1k",
    coverUrl: cover("id", 480, 640),
  },
  {
    id: "burger",
    legacyId: 20,
    title: "汉堡广告海报",
    category: "营销",
    promptTemplate: "快餐汉堡广告，食欲感构图，暖色调，商业摄影",
    modelId: "omni-v2",
    aspectRatio: "16:9",
    resolution: "2k",
    coverUrl: cover("burger", 640, 420),
  },
  {
    id: "retouch",
    legacyId: 21,
    title: "产品精修",
    category: "电商",
    promptTemplate: "产品精修，去瑕疵，增强质感与锐度，电商标准",
    modelId: "latest-v2-pro",
    aspectRatio: "1:1",
    resolution: "2k",
    coverUrl: cover("retouch", 520, 520),
  },
  {
    id: "creative-product",
    legacyId: 22,
    title: "创意产品图",
    category: "创意",
    promptTemplate: "创意合成产品场景，节日主题，氛围感强",
    modelId: "seedream-5",
    aspectRatio: "16:9",
    resolution: "2k",
    coverUrl: cover("creative", 640, 400),
  },
  {
    id: "main-image",
    legacyId: 23,
    title: "电商主图",
    category: "电商",
    promptTemplate: "淘宝主图风格，产品居中，干净背景，高点击欲望",
    modelId: "latest-v2-pro",
    aspectRatio: "1:1",
    resolution: "2k",
    coverUrl: cover("main", 520, 520),
  },
  {
    id: "steps",
    legacyId: 24,
    title: "步骤讲解图",
    category: "新媒体",
    promptTemplate: "教程步骤图，编号清晰，扁平风格，适合图文教程",
    modelId: "omni-v2",
    aspectRatio: "16:9",
    resolution: "1k",
    coverUrl: cover("steps", 640, 400),
  },
  {
    id: "storyboard",
    legacyId: 25,
    title: "影视分镜",
    category: "创意",
    promptTemplate: "电影分镜风格，戏剧光影，宽画幅，叙事感",
    modelId: "seedream-5",
    aspectRatio: "16:9",
    resolution: "2k",
    coverUrl: cover("story", 640, 400),
  },
  {
    id: "xhs",
    legacyId: 26,
    title: "小红书海报",
    category: "新媒体",
    promptTemplate: "小红书竖版海报，大字标题，生活感构图，种草风格",
    modelId: "omni-v2",
    aspectRatio: "2:3",
    resolution: "1k",
    coverUrl: cover("xhs", 480, 640),
  },
  {
    id: "restore",
    legacyId: 27,
    title: "照片修复上色",
    category: "修复",
    promptTemplate: "修复老照片划痕并自然上色，保留年代质感",
    modelId: "omni-v2",
    aspectRatio: "16:9",
    resolution: "2k",
    coverUrl: cover("restore", 640, 420),
  },
];

export function seedInspirationTemplates() {
  const count = db
    .prepare("SELECT COUNT(*) as c FROM inspiration_templates")
    .get() as { c: number };
  if (count.c >= 20) return;

  const insert = db.prepare(
    `INSERT INTO inspiration_templates (
      id, legacy_id, title, category, prompt_template, variables_json,
      model_id, aspect_ratio, resolution, cover_url, reference_assets_json,
      status, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?)`,
  );

  for (const item of SEED_ITEMS) {
    const exists = db
      .prepare("SELECT id FROM inspiration_templates WHERE id = ?")
      .get(item.id);
    if (exists) continue;

    const refs = item.referenceUrls?.length
      ? JSON.stringify(item.referenceUrls.map((url) => ({ url })))
      : JSON.stringify([{ url: item.coverUrl }]);

    insert.run(
      item.id,
      item.legacyId,
      item.title,
      item.category,
      item.promptTemplate,
      item.variables?.length ? JSON.stringify(item.variables) : null,
      item.modelId,
      item.aspectRatio,
      item.resolution,
      item.coverUrl,
      refs,
      item.legacyId,
    );
  }
}
