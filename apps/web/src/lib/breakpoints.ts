/** 移动端断点（与 Tailwind md: 对齐，全项目统一引用） */
export const MOBILE_BREAKPOINT = 768;

export function isMobileViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches;
}
