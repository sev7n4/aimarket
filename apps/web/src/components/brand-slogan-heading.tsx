"use client";

import { BrandMarkIcon } from "@/components/brand-mark-icon";
import {
  BRAND_SLOGAN,
  PRODUCTION_HERO_SLOGAN,
  PRODUCTION_HERO_TAGLINE,
} from "@/lib/brand";

function splitSlogan(text: string): [string, string] {
  const comma = text.indexOf("，");
  if (comma === -1) return [text, ""];
  return [text.slice(0, comma + 1), text.slice(comma + 1).trim()];
}

interface BrandSloganHeadingProps {
  className?: string;
  /** 首页制片 Hero 使用制片工作台主标 */
  variant?: "default" | "production";
}

/**
 * 首页 Hero Slogan：衬线展示字 + 墨鱼π 品牌渐变与微光动效
 */
export function BrandSloganHeading({
  className = "",
  variant = "production",
}: BrandSloganHeadingProps) {
  const slogan =
    variant === "production" ? PRODUCTION_HERO_SLOGAN : BRAND_SLOGAN;
  const [lead, tail] = splitSlogan(slogan);

  return (
    <div className={`brand-slogan-hero relative px-1 ${className}`}>
      <div
        className="brand-slogan-hero__lights pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        aria-hidden
      >
        <div className="brand-slogan-hero__spot" />
        <div className="brand-slogan-hero__beam" />
        <div className="brand-slogan-hero__flare" />
      </div>
      <div className="relative mb-4 flex justify-center sm:mb-5">
        <BrandMarkIcon size="hero" presentation="hero" />
      </div>
      <div
        className="brand-slogan-ornament relative z-[1] mx-auto mb-5 sm:mb-6"
        aria-hidden
      />
      <h1
        className="brand-slogan-heading text-center"
        aria-label={slogan}
      >
        <span className="brand-slogan-line brand-slogan-line--lead block">
          {lead}
        </span>
        {tail ? (
          <span className="brand-slogan-line brand-slogan-line--tail mt-2 block sm:mt-2.5">
            {tail}
          </span>
        ) : null}
      </h1>
      {variant === "production" ? (
        <p className="mt-3 text-center text-sm text-zinc-400 sm:text-base">
          {PRODUCTION_HERO_TAGLINE}
        </p>
      ) : null}
      <div
        className="brand-slogan-glow pointer-events-none absolute inset-x-8 top-1/2 -z-10 h-24 -translate-y-1/2 rounded-full blur-3xl sm:inset-x-12 sm:h-28"
        aria-hidden
      />
    </div>
  );
}
