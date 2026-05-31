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
  const covers: Record<string, string> = {
    "product-photo": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=480&h=640&fit=crop",
    "product-photo-ref-1": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=480&h=640&fit=crop",
    "product-photo-ref-2": "https://images.unsplash.com/photo-1560343090-f0409e92791a?w=480&h=640&fit=crop",
    "product-photo-ref-3": "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=480&h=640&fit=crop",
    "tryon": "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=480&h=640&fit=crop",
    "poster": "https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=640&h=420&fit=crop",
    "social": "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=520&h=520&fit=crop",
    "detail": "https://images.unsplash.com/photo-1441986300932-4e1d0ea9e78e?w=480&h=640&fit=crop",
    "surreal": "https://images.unsplash.com/photo-1618005182384-a83a8bd0fbe6?w=640&h=400&fit=crop",
    "tea": "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=480&h=640&fit=crop",
    "render": "https://images.unsplash.com/photo-1505340697520-40e8f2737664?w=520&h=520&fit=crop",
    "print": "https://images.unsplash.com/photo-1544717297-fa95b6ee9643?w=640&h=420&fit=crop",
    "wiki": "https://images.unsplash.com/photo-1456324504439-367cee3b3c32?w=640&h=400&fit=crop",
    "city": "https://images.unsplash.com/photo-1514565131-fce0801e5785?w=480&h=640&fit=crop",
    "biz": "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=480&h=640&fit=crop",
    "hand": "https://images.unsplash.com/photo-1523397408725-0c8c5d945e90?w=520&h=520&fit=crop",
    "movie": "https://images.unsplash.com/photo-1489599849927-6f3b9a6c8a1e?w=480&h=640&fit=crop",
    "onboard": "https://images.unsplash.com/photo-1551430180-7dde2a0b6e0e?w=640&h=400&fit=crop",
    "promo": "https://images.unsplash.com/photo-1526170371875-21c5e7b6e6f9?w=520&h=520&fit=crop",
    "sell": "https://images.unsplash.com/photo-1542744173-8e7e5e15bb7c?w=480&h=640&fit=crop",
    "white": "https://images.unsplash.com/photo-1525085325187-4989d8d9d18e?w=520&h=520&fit=crop",
    "id": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=480&h=640&fit=crop",
    "burger": "https://images.unsplash.com/photo-1568901346375-23c9450cdea6?w=640&h=420&fit=crop",
    "retouch": "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=520&h=520&fit=crop",
    "creative": "https://images.unsplash.com/photo-1513151233558-d860c5398176?w=640&h=400&fit=crop",
    "main": "https://images.unsplash.com/photo-1560472354-b33ff0c4a65c?w=520&h=520&fit=crop",
    "steps": "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=640&h=400&fit=crop",
    "story": "https://images.unsplash.com/photo-1536440136628-8b4541e0c921?w=640&h=400&fit=crop",
    "xhs": "https://images.unsplash.com/photo-1516450221441-7735c5e8d33d?w=480&h=640&fit=crop",
    "restore": "https://images.unsplash.com/photo-1516912481808-342e95e3d61d?w=640&h=420&fit=crop",
    /** 首页扇形 7 组服饰套图（与 apps/web/src/lib/inspiration-apparel-fan.ts 封面保持一致） */
    "apparel-tryon": "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=520&h=700&fit=crop&q=90",
    "apparel-white": "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=520&h=520&fit=crop&q=90",
    "apparel-street": "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=520&h=700&fit=crop&q=90",
    "apparel-selling": "https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=520&h=700&fit=crop&q=90",
    "apparel-colorways": "https://images.unsplash.com/photo-1558171813-4c088753af8f?w=520&h=520&fit=crop&q=90",
    "apparel-detail": "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=520&h=700&fit=crop&q=90",
    "apparel-video": "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=520&h=700&fit=crop&q=90",
  };
  return covers[seed] ?? `https://picsum.photos/seed/aimarket-${seed}/${w}/${h}`;
}

const SEED_ITEMS: SeedItem[] = [
  {
    id: "product-photo",
    legacyId: 1,
    title: "产品摄影图",
    category: "电商",
    promptTemplate:
      "专业产品摄影，{{product}}置于大理石台面，柔和侧光，商业摄影质感，高端电商主图风格",
    modelId: "latest-v2-pro",
    aspectRatio: "2:3",
    resolution: "2k",
    coverUrl: cover("product-photo", 480, 640),
    variables: [{ key: "product", label: "产品", default: "护肤品" }],
    referenceUrls: [
      cover("product-photo-ref-1", 480, 640),
      cover("product-photo-ref-2", 480, 640),
      cover("product-photo-ref-3", 480, 640),
    ],
  },
  {
    id: "virtual-tryon",
    legacyId: 2,
    title: "虚拟试衣",
    category: "服饰",
    promptTemplate: "时尚模特穿搭摄影，模特身着外套，自然站姿，都市街拍风格，高质感服饰展示",
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
    promptTemplate: "促销海报设计，新品上市与限时折扣主题，视觉冲击力强，商业营销风格",
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
    promptTemplate: "社交媒体封面图，标题醒目，清新配色，适合小红书等平台传播",
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
    promptTemplate: "电商详情页卖点模块，突出核心功能与材质特点，信息层次清晰，专业产品展示",
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
    promptTemplate: "超现实创意场景，产品悬浮效果，霓虹光效，创意广告视觉风格",
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
    promptTemplate: "茶饮新品上市海报，清新绿色调，大字标题，食欲感构图，饮品营销风格",
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
    promptTemplate: "3D 渲染风格产品效果图，科技感背景，高精度材质展示，专业产品视觉",
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
    promptTemplate: "线下印刷海报，高对比排版，品牌色统一，适合大幅面输出与展示",
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
    promptTemplate: "科普信息图风格，分步骤图解说明，扁平插画风格，易于理解的教育内容",
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
    promptTemplate: "城市文旅宣传海报，夜景与地标建筑结合，电影感色调，旅游营销风格",
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
    promptTemplate: "商务活动主视觉海报，稳重蓝金配色，专业可信的企业形象展示",
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
    promptTemplate: "模特手持商品展示图，生活化场景，自然光效果，真实感电商摄影",
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
    promptTemplate: "电影海报风格，戏剧光影效果，人物特写，宽画幅叙事构图",
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
    promptTemplate: "平台入驻宣传图，突出权益与流程指引，信息架构清晰，商业推广风格",
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
    promptTemplate: "商品多角度宣传拼图，统一背景风格，电商详情页展示效果",
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
    promptTemplate: "三卖点竖版海报，图标配合短文案，转化导向的营销设计",
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
    promptTemplate: "产品抠图并生成纯白底商品主图，边缘干净清晰，符合电商平台规范",
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
    promptTemplate: "美式证件照风格，纯色背景，光线均匀，五官清晰，专业肖像摄影",
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
    promptTemplate: "快餐汉堡广告海报，食欲感构图，暖色调，商业食品摄影风格",
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
    promptTemplate: "产品精修处理，去除瑕疵，增强质感与锐度，符合电商标准",
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
    promptTemplate: "创意合成产品场景，节日主题氛围，创意广告视觉效果",
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
    promptTemplate: "淘宝主图风格，产品居中展示，干净背景，高点击欲望的电商摄影",
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
    promptTemplate: "教程步骤图解，编号清晰，扁平风格设计，适合图文教程展示",
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
    promptTemplate: "电影分镜风格，戏剧光影，宽画幅构图，叙事感影视视觉",
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
    promptTemplate: "小红书竖版海报，大字标题，生活感构图，种草风格内容展示",
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
    promptTemplate: "修复老照片划痕并自然上色，保留年代质感与历史韵味",
    modelId: "omni-v2",
    aspectRatio: "16:9",
    resolution: "2k",
    coverUrl: cover("restore", 640, 420),
  },
  {
    id: "apparel-tryon-main",
    legacyId: 28,
    title: "模特换衣主图",
    category: "服饰",
    promptTemplate:
      "时尚模特穿搭摄影，模特身着服装，自然姿态，专业摄影光感，高质感电商主图风格，背景简洁高级，突出服装版型与面料质感。",
    modelId: "latest-v2-pro",
    aspectRatio: "3:4",
    resolution: "2k",
    coverUrl: cover("apparel-tryon", 520, 700),
  },
  {
    id: "apparel-white-bg",
    legacyId: 29,
    title: "白底标准图",
    category: "服饰",
    promptTemplate:
      "服装产品白底摄影图，纯白背景，服装主体居中，边缘干净清晰，颜色还原准确，符合电商平台主图规范，专业商业摄影质感。",
    modelId: "latest-v2-pro",
    aspectRatio: "1:1",
    resolution: "2k",
    coverUrl: cover("apparel-white", 520, 520),
  },
  {
    id: "apparel-street-scene",
    legacyId: 30,
    title: "场景种草图",
    category: "服饰",
    promptTemplate:
      "都市街拍时尚穿搭图，模特在城市街道场景中，自然光，轻松姿态，突出版型与上身效果，适合种草营销的高质感街拍风格。",
    modelId: "latest-v2-pro",
    aspectRatio: "3:4",
    resolution: "2k",
    coverUrl: cover("apparel-street", 520, 700),
  },
  {
    id: "apparel-selling-poster",
    legacyId: 31,
    title: "卖点信息图",
    category: "服饰",
    promptTemplate:
      "服装卖点营销海报，时尚摄影风格，突出面料质感、版型设计、工艺细节，留出文字信息区，信息层级清晰，适合电商详情页展示。",
    modelId: "omni-v2",
    aspectRatio: "3:4",
    resolution: "2k",
    coverUrl: cover("apparel-selling", 520, 700),
  },
  {
    id: "apparel-colorways",
    legacyId: 32,
    title: "多色多款展示图",
    category: "服饰",
    promptTemplate:
      "服装多色展示图，同一款式展示 3-5 个不同颜色版本，保持款式结构完全一致，专业产品摄影风格，适合 SKU 多色展示与选款。",
    modelId: "latest-v2-pro",
    aspectRatio: "1:1",
    resolution: "2k",
    coverUrl: cover("apparel-colorways", 520, 520),
  },
  {
    id: "apparel-detail-closeup",
    legacyId: 33,
    title: "细节特写图",
    category: "服饰",
    promptTemplate:
      "服装细节特写摄影，突出领口、袖口、走线与面料纹理，专业商业摄影光感，高清晰度展示工艺细节，适合详情页卖点展示。",
    modelId: "latest-v2-pro",
    aspectRatio: "3:4",
    resolution: "4k",
    coverUrl: cover("apparel-detail", 520, 700),
  },
  {
    id: "apparel-promo-video",
    legacyId: 34,
    title: "短视频封面套图",
    category: "服饰",
    promptTemplate:
      "时尚短视频封面风格套图，模特身着服装，动态姿态，视觉冲击力强，风格统一，适合短视频投放与详情页主图展示。",
    modelId: "latest-v2-pro",
    aspectRatio: "3:4",
    resolution: "2k",
    coverUrl: cover("apparel-video", 520, 700),
  },
];

function referenceAssetsJson(item: SeedItem) {
  const refs = item.referenceUrls?.length
    ? item.referenceUrls.map((url) => ({ url }))
    : [{ url: item.coverUrl }];
  return JSON.stringify(refs);
}

/** 首页扇形套图 sort_order 1–7，其余模板沿用 legacy_id */
function sortOrderFor(item: SeedItem) {
  if (item.id.startsWith("apparel-")) {
    const rank = item.legacyId - 27;
    return rank >= 1 && rank <= 7 ? rank : item.legacyId;
  }
  return item.legacyId;
}

export function seedInspirationTemplates() {
  const insert = db.prepare(
    `INSERT INTO inspiration_templates (
      id, legacy_id, title, category, prompt_template, variables_json,
      model_id, aspect_ratio, resolution, cover_url, reference_assets_json,
      status, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?)`,
  );

  const refreshApparel = db.prepare(
    `UPDATE inspiration_templates SET
      title = ?, category = ?, prompt_template = ?, model_id = ?,
      aspect_ratio = ?, resolution = ?, cover_url = ?, reference_assets_json = ?,
      sort_order = ?, updated_at = datetime('now')
     WHERE id = ?`,
  );

  for (const item of SEED_ITEMS) {
    const refsJson = referenceAssetsJson(item);
    const sortOrder = sortOrderFor(item);
    const exists = db
      .prepare("SELECT id FROM inspiration_templates WHERE id = ?")
      .get(item.id);

    if (exists) {
      if (item.id.startsWith("apparel-")) {
        refreshApparel.run(
          item.title,
          item.category,
          item.promptTemplate,
          item.modelId,
          item.aspectRatio,
          item.resolution,
          item.coverUrl,
          refsJson,
          sortOrder,
          item.id,
        );
      }
      continue;
    }

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
      refsJson,
      sortOrder,
    );
  }
}
