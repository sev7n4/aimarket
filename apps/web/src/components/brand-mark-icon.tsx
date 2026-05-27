"use client";

import { useId } from "react";

const sizes = {
  sm: 28,
  md: 32,
  lg: 48,
} as const;

interface BrandMarkIconProps {
  size?: keyof typeof sizes;
  className?: string;
}

/** 出图宝图形标：套图叠层 + 主图卡片 + 播放标（图→片） */
export function BrandMarkIcon({
  size = "md",
  className = "",
}: BrandMarkIconProps) {
  const uid = useId().replace(/:/g, "");
  const gradId = `ctb-grad-${uid}`;
  const badgeId = `ctb-badge-${uid}`;
  const px = sizes[size];

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-hidden
    >
      <defs>
        <linearGradient
          id={gradId}
          x1="4"
          y1="2"
          x2="28"
          y2="30"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#FB923C" />
          <stop offset="1" stopColor="#A855F7" />
        </linearGradient>
        <linearGradient
          id={badgeId}
          x1="19"
          y1="19"
          x2="29"
          y2="29"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#F97316" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
      <rect
        x="3"
        y="9"
        width="14"
        height="14"
        rx="3.5"
        fill="#7C3AED"
        fillOpacity="0.3"
        transform="rotate(-10 10 16)"
      />
      <rect x="6" y="3" width="18" height="18" rx="4.5" fill={`url(#${gradId})`} />
      <rect
        x="8.5"
        y="5.5"
        width="13"
        height="9.5"
        rx="2"
        fill="white"
        fillOpacity="0.24"
      />
      <circle cx="23" cy="23" r="6.5" fill={`url(#${badgeId})`} />
      <path d="M21.1 19.9v6.2l4.4-3.1-4.4-3.1z" fill="white" />
    </svg>
  );
}
