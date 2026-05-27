/**
 * 出图宝 — 对外品牌常量（工程代号 AIMarket）
 *
 * Logo 组合规范见 docs/PRODUCT.md §1.1
 * SVG 源文件：apps/web/public/brand/
 */

/** 主标字标：导航、Hero、登录等 */
export const BRAND_NAME = "出图宝";

/** 完整 Slogan：Hero、关于页、登录弹窗副标 */
export const BRAND_SLOGAN = "商品图到短视频，一套做完上架。";

/** 图形标说明（叠图卡片 + 播放标，见 BrandMarkIcon） */
export const BRAND_MARK_DESC = "套图叠层 · 主图卡片 · 宣传短视频播放标";

/** 窄位副标：侧栏、极小屏（可选，非 Slogan 替代） */
export const BRAND_TAGLINE_SHORT = "图到片 · 一套上架";

/** Logo 无障碍描述 */
export const BRAND_LOGO_ARIA = `${BRAND_NAME}，${BRAND_SLOGAN}`;

export type BrandLogoVariant = "mark" | "lockup" | "icon";

export interface BrandLogoCopy {
  markDesc: string;
  name: string;
  slogan: string;
  taglineShort: string;
}

export const brandLogoCopy: BrandLogoCopy = {
  markDesc: BRAND_MARK_DESC,
  name: BRAND_NAME,
  slogan: BRAND_SLOGAN,
  taglineShort: BRAND_TAGLINE_SHORT,
};
