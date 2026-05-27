import Link from "next/link";
import {
  BRAND_LOGO_ARIA,
  BRAND_NAME,
  BRAND_SLOGAN,
  type BrandLogoVariant,
} from "@/lib/brand";
import { BrandMarkIcon } from "@/components/brand-mark-icon";

interface BrandLogoProps {
  variant?: BrandLogoVariant;
  /** 作为链接包裹（默认 false） */
  href?: string;
  className?: string;
  markSize?: "sm" | "md" | "lg";
  /** Hero 等页面主标题时使用 h1 */
  promoteHeading?: boolean;
}

function LogoContent({
  variant,
  markSize,
  promoteHeading,
}: {
  variant: BrandLogoVariant;
  markSize: "sm" | "md" | "lg";
  promoteHeading?: boolean;
}) {
  if (variant === "icon") {
    return <BrandMarkIcon size={markSize} />;
  }

  if (variant === "lockup") {
    return (
      <span className="flex items-center gap-3 text-left">
        <BrandMarkIcon size={markSize} />
        <span className="flex min-w-0 flex-col">
          {promoteHeading ? (
            <h1 className="text-lg font-bold tracking-tight text-zinc-50 sm:text-xl md:text-2xl">
              {BRAND_NAME}
            </h1>
          ) : (
            <span className="text-lg font-bold tracking-tight text-zinc-50">
              {BRAND_NAME}
            </span>
          )}
          <p className="text-xs leading-snug text-zinc-500 sm:text-sm">
            {BRAND_SLOGAN}
          </p>
        </span>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <BrandMarkIcon size={markSize} />
      <span className="font-semibold tracking-tight text-zinc-100">
        {BRAND_NAME}
      </span>
    </span>
  );
}

export function BrandLogo({
  variant = "mark",
  href,
  className = "",
  markSize = "md",
  promoteHeading = false,
}: BrandLogoProps) {
  const inner = (
    <LogoContent
      variant={variant}
      markSize={markSize}
      promoteHeading={promoteHeading}
    />
  );

  if (href) {
    return (
      <Link
        href={href}
        className={`inline-flex ${className}`}
        aria-label={BRAND_LOGO_ARIA}
      >
        {inner}
      </Link>
    );
  }

  return (
    <span className={`inline-flex ${className}`} aria-label={BRAND_LOGO_ARIA}>
      {inner}
    </span>
  );
}
