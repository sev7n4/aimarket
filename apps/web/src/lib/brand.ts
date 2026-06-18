/**
 * 墨鱼π — 对外品牌常量（工程代号 AIMarket）
 *
 * Logo 组合规范见 docs/PRODUCT.md §1.1
 * 图形标源文件：apps/web/public/brand/mascot*.png
 */

/** 主标字标：导航、Hero、登录等 */
export const BRAND_NAME = "墨鱼π";

/** 完整 Slogan：Hero、关于页、登录弹窗副标 */
export const BRAND_SLOGAN = "开始你的创意，创造无限可能";

/** 公司主体（图形标版权归属） */
export const BRAND_COMPANY = "墨鱼科技";

/** 图形标说明（3D 墨鱼吉祥物，见 BrandMarkIcon） */
export const BRAND_MARK_DESC = "墨鱼吉祥物 · 深海紫调";

/** 墨鱼图形标静态资源（按显示尺寸选用，避免加载原图） */
export const BRAND_MASCOT = {
  full: "/brand/mascot.png",
  lg: "/brand/mascot-256.png",
  md: "/brand/mascot-128.png",
  sm: "/brand/mascot-64.png",
  xs: "/brand/mascot-32.png",
} as const;

/** 窄位副标：侧栏、极小屏（可选，非 Slogan 替代） */
export const BRAND_TAGLINE_SHORT = "所想即所得";

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
