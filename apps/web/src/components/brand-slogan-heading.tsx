"use client";

import { BRAND_SLOGAN } from "@/lib/brand";

function splitSlogan(text: string): [string, string] {
  const comma = text.indexOf("，");
  if (comma === -1) return [text, ""];
  return [text.slice(0, comma + 1), text.slice(comma + 1).trim()];
}

interface BrandSloganHeadingProps {
  className?: string;
}

/**
 * 首页 Hero Slogan：衬线展示字 + 墨鱼π 品牌渐变与微光动效
 */
export function BrandSloganHeading({ className = "" }: BrandSloganHeadingProps) {
  const [lead, tail] = splitSlogan(BRAND_SLOGAN);

  return (
    <div className={`relative px-1 ${className}`}>
      <div
        className="brand-slogan-ornament mx-auto mb-5 sm:mb-6"
        aria-hidden
      />
      <h1
        className="brand-slogan-heading text-center"
        aria-label={BRAND_SLOGAN}
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
      <div
        className="brand-slogan-glow pointer-events-none absolute inset-x-8 top-1/2 -z-10 h-24 -translate-y-1/2 rounded-full blur-3xl sm:inset-x-12 sm:h-28"
        aria-hidden
      />
    </div>
  );
}
