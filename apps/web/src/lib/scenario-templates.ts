/**
 * 首页扇形灵感套图模板：按品类组织高频电商场景。
 * 每个场景导入工作台 / 画布时会注入默认提示词与建议的 AI 工具链。
 */

export type ScenarioCategoryId = "apparel" | "ecommerce" | "marketing";

export interface ScenarioCategory {
  id: ScenarioCategoryId;
  label: string;
  description: string;
  available: boolean;
}

export interface ScenarioTemplate {
  /** 全局唯一 id，作为灵感模板 id 透传到 Studio */
  id: string;
  category: ScenarioCategoryId;
  /** 场景标题，例如「模特换衣主图」 */
  title: string;
  /** 一句话效果描述，作为卡片副标题 */
  subtitle: string;
  /** 注入工作台的默认提示词 */
  prompt: string;
  /** 建议的 AI 工具链（用于卡片底部 chips 展示） */
  tools: string[];
  /** 卡片封面图，默认走 picsum seed */
  coverUrl: string;
  /** 卡片在 Studio 中的默认输出比例 */
  aspectRatio: "1:1" | "3:4" | "2:3" | "4:5" | "16:9";
  /** 推荐模型，默认走电商最强图像模型 */
  modelId: string;
  /** 默认分辨率 */
  resolution: "1k" | "2k" | "4k";
}

function cover(seed: string, w = 480, h = 640) {
  const covers: Record<string, string> = {
    "apparel-tryon": "https://images.unsplash.com/photo-1496737619791-405af7d1a28f?w=520&h=700&fit=crop&q=90",
    "apparel-white": "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=520&h=520&fit=crop&q=90",
    "apparel-street": "https://images.unsplash.com/photo-1539109136881-3be0616acf37?w=520&h=700&fit=crop&q=90",
    "apparel-selling": "https://images.unsplash.com/photo-1558618666-fcd2548563b7?w=520&h=700&fit=crop&q=90",
    "apparel-colorways": "https://images.unsplash.com/photo-1558171813-4c088753af8f?w=520&h=520&fit=crop&q=90",
    "apparel-detail": "https://images.unsplash.com/photo-1620799140188-3b2a02c9e4f8?w=520&h=700&fit=crop&q=90",
    "apparel-video": "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=520&h=700&fit=crop&q=90",
  };
  return covers[seed] ?? `https://picsum.photos/seed/aimarket-scenario-${seed}/${w}/${h}`;
}

export const SCENARIO_CATEGORIES: ScenarioCategory[] = [
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

export const APPAREL_SCENARIO_TEMPLATES: ScenarioTemplate[] = [
  {
    id: "apparel-tryon-main",
    category: "apparel",
    title: "模特换衣主图",
    subtitle: "上传平铺图 + 模特图，自动换衣输出主图",
    prompt:
      "时尚模特穿搭摄影，模特身着服装，自然姿态，专业摄影光感，高质感电商主图风格，背景简洁高级，突出服装版型与面料质感。",
    tools: ["Agent 串联", "局部重绘", "细节增强"],
    coverUrl: cover("apparel-tryon", 520, 700),
    aspectRatio: "3:4",
    modelId: "latest-v2-pro",
    resolution: "2k",
  },
  {
    id: "apparel-white-bg",
    category: "apparel",
    title: "白底标准图",
    subtitle: "上传服装图，自动抠图并输出平台合规白底",
    prompt:
      "服装产品白底摄影图，纯白背景，服装主体居中，边缘干净清晰，颜色还原准确，符合电商平台主图规范，专业商业摄影质感。",
    tools: ["抠图", "擦除", "超分"],
    coverUrl: cover("apparel-white", 520, 520),
    aspectRatio: "1:1",
    modelId: "latest-v2-pro",
    resolution: "2k",
  },
  {
    id: "apparel-street-scene",
    category: "apparel",
    title: "场景种草图",
    subtitle: "都市通勤 / 街拍场景，突出上身效果",
    prompt:
      "都市街拍时尚穿搭图，模特在城市街道场景中，自然光，轻松姿态，突出版型与上身效果，适合种草营销的高质感街拍风格。",
    tools: ["套图生成", "扩图", "场景重跑"],
    coverUrl: cover("apparel-street", 520, 700),
    aspectRatio: "3:4",
    modelId: "latest-v2-pro",
    resolution: "2k",
  },
  {
    id: "apparel-selling-poster",
    category: "apparel",
    title: "卖点信息图",
    subtitle: "面料 / 版型 / 工艺三段式卖点海报",
    prompt:
      "服装卖点营销海报，时尚摄影风格，突出面料质感、版型设计、工艺细节，留出文字信息区，信息层级清晰，适合电商详情页展示。",
    tools: ["套图生成", "文本工具", "卖点重跑"],
    coverUrl: cover("apparel-selling", 520, 700),
    aspectRatio: "3:4",
    modelId: "omni-v2",
    resolution: "2k",
  },
  {
    id: "apparel-colorways",
    category: "apparel",
    title: "多色多款展示图",
    subtitle: "一键生成 SKU 多色 / 多花型展示",
    prompt:
      "服装多色展示图，同一款式展示 3-5 个不同颜色版本，保持款式结构完全一致，专业产品摄影风格，适合 SKU 多色展示与选款。",
    tools: ["Agent 串联", "局部重绘", "拼图融合"],
    coverUrl: cover("apparel-colorways", 520, 520),
    aspectRatio: "1:1",
    modelId: "latest-v2-pro",
    resolution: "2k",
  },
  {
    id: "apparel-detail-closeup",
    category: "apparel",
    title: "细节特写图",
    subtitle: "领口 / 走线 / 面料纹理商业摄影感",
    prompt:
      "服装细节特写摄影，突出领口、袖口、走线与面料纹理，专业商业摄影光感，高清晰度展示工艺细节，适合详情页卖点展示。",
    tools: ["扩图", "细节增强", "超分"],
    coverUrl: cover("apparel-detail", 520, 700),
    aspectRatio: "3:4",
    modelId: "latest-v2-pro",
    resolution: "4k",
  },
  {
    id: "apparel-promo-video",
    category: "apparel",
    title: "短视频封面套图",
    subtitle: "为短视频准备统一风格的主图 / 封面",
    prompt:
      "时尚短视频封面风格套图，模特身着服装，动态姿态，视觉冲击力强，风格统一，适合短视频投放与详情页主图展示。",
    tools: ["套图生成", "主图重跑", "宣传短视频"],
    coverUrl: cover("apparel-video", 520, 700),
    aspectRatio: "3:4",
    modelId: "latest-v2-pro",
    resolution: "2k",
  },
];

const TEMPLATE_REGISTRY: Record<ScenarioCategoryId, ScenarioTemplate[]> = {
  apparel: APPAREL_SCENARIO_TEMPLATES,
  ecommerce: [],
  marketing: [],
};

export function listScenarioTemplates(
  category: ScenarioCategoryId,
): ScenarioTemplate[] {
  return TEMPLATE_REGISTRY[category] ?? [];
}

export function findScenarioTemplate(id: string): ScenarioTemplate | undefined {
  for (const list of Object.values(TEMPLATE_REGISTRY)) {
    const hit = list.find((item) => item.id === id);
    if (hit) return hit;
  }
  return undefined;
}
