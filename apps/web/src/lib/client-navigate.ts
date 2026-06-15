type AppRouter = {
  push: (href: string) => void;
  replace?: (href: string) => void;
};

/**
 * App Router 软导航在部分生产构建/E2E 下可能不更新 location；
 * 下一 tick 仍未到达目标 URL 时回退为硬跳转。
 */
export function clientNavigate(
  router: AppRouter,
  href: string,
  mode: "push" | "replace" = "push",
) {
  if (mode === "replace" && router.replace) router.replace(href);
  else router.push(href);

  if (typeof window === "undefined") return;

  window.setTimeout(() => {
    try {
      const target = new URL(href, window.location.origin);
      const current = new URL(window.location.href);
      if (
        current.pathname !== target.pathname ||
        current.search !== target.search
      ) {
        window.location.assign(href);
      }
    } catch {
      window.location.assign(href);
    }
  }, 0);
}
