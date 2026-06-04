import type { CreationMode } from "@aimarket/ui";

/** 对标椒图：工作台输入框轮播「试试输入：…」 */
export const rotatingHints: Record<CreationMode, string[]> = {
  chat: [
    "让照片上的人物笑起来",
    "把背景换成海边日落",
    "给人物换上红色连衣裙",
    "增强照片质感，电影级调色",
    "去除画面中的路人",
    "让产品图更有高级感",
  ],
  image: [
    "从特写视角生成这张图片",
    "生成同款风格的 4 张变体",
    "高清放大并保留细节",
    "换成白底商品主图",
    "添加柔和摄影棚光",
  ],
  ecommerce: [
    "填写产品卖点、规格、材质与目标人群",
    "生成淘宝风主图与详情页头图",
    "突出限时折扣与核心功能",
    "适配抖音竖版商品展示",
  ],
};

export function formatRotatingPlaceholder(mode: CreationMode, hint: string) {
  if (mode === "ecommerce") return hint;
  return `试试输入：${hint}`;
}
