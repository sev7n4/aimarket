type AppRouter = {
  push: (href: string) => void;
  replace?: (href: string) => void;
};

function parseHref(href: string): URL | null {
  if (typeof window === "undefined") return null;
  try {
    return new URL(href, window.location.origin);
  } catch {
    return null;
  }
}

/** 同 pathname 仅 query 变化（典型：/studio?sessionId=…）时 App Router 软导航常不 remount */
function isSamePathQueryOnlyNav(href: string): boolean {
  const target = parseHref(href);
  if (!target || typeof window === "undefined") return false;
  const current = new URL(window.location.href);
  return (
    current.pathname === target.pathname &&
    current.search !== target.search
  );
}

/**
 * App Router 软导航在部分生产构建/E2E 下可能不更新 location 或 remount；
 * 同页 query 切换（Studio sessionId）直接硬跳转，其余场景下一 tick 校验后回退。
 */
export function clientNavigate(
  router: AppRouter,
  href: string,
  mode: "push" | "replace" = "push",
) {
  if (typeof window !== "undefined" && isSamePathQueryOnlyNav(href)) {
    window.location.assign(href);
    return;
  }

  if (mode === "replace" && router.replace) router.replace(href);
  else router.push(href);

  if (typeof window === "undefined") return;

  window.setTimeout(() => {
    const target = parseHref(href);
    if (!target) {
      window.location.assign(href);
      return;
    }
    const current = new URL(window.location.href);
    if (
      current.pathname !== target.pathname ||
      current.search !== target.search
    ) {
      window.location.assign(href);
    }
  }, 0);
}
