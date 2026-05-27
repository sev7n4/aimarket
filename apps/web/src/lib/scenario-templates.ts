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
  return `https://picsum.photos/seed/aimarket-scenario-${seed}/${w}/${h}`;
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
      "上传服装平铺图与模特图，保持模特姿态不变，将服装自然穿戴到模特身上，保留真实褶皱与面料质感，输出电商主图风格。",
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
      "将服装主体抠出并置于纯白背景，边缘干净，颜色还原准确，符合平台主图规范。",
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
      "将服装生成都市通勤场景穿搭图，自然光，人物姿态轻松，突出版型与上身效果。",
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
      "生成服装卖点海报，突出面料、版型、透气性，留出文字区，信息层级清晰。",
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
      "同一服装生成 3-5 个颜色或花型版本，保持款式结构一致，适合 SKU 展示。",
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
      "输出服装细节特写，突出领口、袖口、走线与面料纹理，商业摄影光感。",
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
      "基于服装主图与场景图生成短视频封面级套图，风格统一，适合投放和详情页。",
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
