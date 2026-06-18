"use client";

import Image from "next/image";
import { BRAND_MASCOT } from "@/lib/brand";

const sizes = {
  sm: 28,
  md: 32,
  lg: 48,
  xl: 72,
  hero: 140,
} as const;

type BrandMarkSize = keyof typeof sizes;

function mascotSrcForPx(px: number): string {
  if (px <= 32) return BRAND_MASCOT.xs;
  if (px <= 48) return BRAND_MASCOT.sm;
  if (px <= 72) return BRAND_MASCOT.md;
  if (px <= 140) return BRAND_MASCOT.lg;
  return BRAND_MASCOT.full;
}

interface BrandMarkIconProps {
  size?: BrandMarkSize;
  className?: string;
  /** mark：导航/侧栏小标；hero：首页主视觉 */
  presentation?: "mark" | "hero";
}

/**
 * 墨鱼π 图形标：3D 墨鱼吉祥物（透明底）
 */
export function BrandMarkIcon({
  size = "md",
  className = "",
  presentation = "mark",
}: BrandMarkIconProps) {
  const px = sizes[size];
  const src = mascotSrcForPx(px);
  const isHero = presentation === "hero";

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ${
        isHero ? "brand-mascot-hero" : ""
      } ${className}`}
      style={{ width: px, height: px }}
    >
      <Image
        src={src}
        alt=""
        width={px}
        height={px}
        sizes={`${px}px`}
        priority={isHero}
        className={
          isHero
            ? "size-full object-contain drop-shadow-[0_8px_24px_rgba(147,112,219,0.4)]"
            : "size-full object-contain drop-shadow-[0_2px_8px_rgba(147,112,219,0.25)]"
        }
        aria-hidden
      />
    </span>
  );
}
