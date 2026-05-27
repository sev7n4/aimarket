import Link from "next/link";
import {
  BRAND_LOGO_ARIA,
  BRAND_MONOGRAM,
  BRAND_NAME,
  BRAND_SLOGAN,
  type BrandLogoVariant,
} from "@/lib/brand";

const monogramClass =
  "flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-purple-600 font-bold text-white";

interface BrandLogoProps {
  variant?: BrandLogoVariant;
  /** 作为链接包裹（默认 false） */
  href?: string;
  className?: string;
  monogramSize?: "sm" | "md" | "lg";
  /** Hero 等页面主标题时使用 h1 */
  promoteHeading?: boolean;
}

const monogramSizes = {
  sm: "size-7 text-xs",
  md: "size-8 text-sm",
  lg: "size-12 text-lg",
} as const;

function Monogram({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  return (
    <span className={`${monogramClass} ${monogramSizes[size]}`} aria-hidden>
      {BRAND_MONOGRAM}
    </span>
  );
}

function LogoContent({
  variant,
  monogramSize,
  promoteHeading,
}: {
  variant: BrandLogoVariant;
  monogramSize: "sm" | "md" | "lg";
  promoteHeading?: boolean;
}) {
  if (variant === "icon") {
    return <Monogram size={monogramSize} />;
  }

  if (variant === "lockup") {
    return (
      <span className="flex items-center gap-3 text-left">
        <Monogram size={monogramSize} />
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
      <Monogram size={monogramSize} />
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
  monogramSize = "md",
  promoteHeading = false,
}: BrandLogoProps) {
  const inner = (
    <LogoContent
      variant={variant}
      monogramSize={monogramSize}
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
