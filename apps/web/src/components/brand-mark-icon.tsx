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

/**
 * 墨鱼科技图形标：墨鱼穹顶 + π 触须 + 墨滴涟漪（深海墨蓝 → 创意紫）
 */
export function BrandMarkIcon({
  size = "md",
  className = "",
}: BrandMarkIconProps) {
  const uid = useId().replace(/:/g, "");
  const inkId = `moyu-ink-${uid}`;
  const glowId = `moyu-glow-${uid}`;
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
          id={inkId}
          x1="4"
          y1="3"
          x2="28"
          y2="29"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#22D3EE" />
          <stop offset="0.45" stopColor="#6366F1" />
          <stop offset="1" stopColor="#A855F7" />
        </linearGradient>
        <radialGradient
          id={glowId}
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(16 17) rotate(90) scale(14)"
        >
          <stop stopColor="#22D3EE" stopOpacity="0.35" />
          <stop offset="1" stopColor="#22D3EE" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* 墨滴底晕 */}
      <circle cx="16" cy="17" r="14" fill={`url(#${glowId})`} />
      {/* 墨鱼穹顶 */}
      <path
        d="M16 4.5c5.2 0 9.5 3.4 9.5 7.6 0 2.2-1.1 4.2-2.9 5.4-.8.5-1.7.8-2.7 1h-7.8c-1 0-1.9-.3-2.7-.8-1.8-1.2-2.9-3.2-2.9-5.6C6.5 7.9 10.8 4.5 16 4.5Z"
        fill={`url(#${inkId})`}
      />
      <ellipse
        cx="18.6"
        cy="9.2"
        rx="1.35"
        ry="1.1"
        fill="white"
        fillOpacity="0.92"
      />
      <circle cx="19" cy="8.95" r="0.42" fill="#0F172A" />
      {/* π 触须（左环 + 竖笔 + 右足） */}
      <path
        d="M10.8 13.8h4.1c2.05 0 3.55 1.25 3.55 3.05 0 1.55-1.15 2.75-2.95 2.95h-1.35v5.6"
        stroke="white"
        strokeWidth="2.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.6 13.8v11.75"
        stroke="white"
        strokeWidth="2.15"
        strokeLinecap="round"
      />
      {/* 副触须 / 墨溅 */}
      <path
        d="M7.5 24.2c1.4-1.6 2.8-1.1 3.6.2"
        stroke="#67E8F9"
        strokeWidth="1.25"
        strokeLinecap="round"
        opacity="0.65"
      />
      <path
        d="M24.8 22.8c-1.3 1.5-2.7 1-3.4-.3"
        stroke="#C4B5FD"
        strokeWidth="1.25"
        strokeLinecap="round"
        opacity="0.55"
      />
      <circle cx="7" cy="26.2" r="1.05" fill="#22D3EE" fillOpacity="0.55" />
      <circle cx="25.5" cy="25.8" r="0.75" fill="#A855F7" fillOpacity="0.45" />
    </svg>
  );
}
