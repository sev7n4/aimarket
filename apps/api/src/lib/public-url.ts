/**
 * 将 `/uploads/...` 转为外部 API 可访问的绝对 URL（Seedream 等供应商需要公网地址）。
 * 优先 API_PUBLIC_URL，兼容 PUBLIC_API_URL（与部署文档/用户习惯一致）。
 */
export function getApiPublicBase(): string {
  const fromEnv =
    process.env.API_PUBLIC_URL?.trim() ||
    process.env.PUBLIC_API_URL?.trim() ||
    "";
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const port = process.env.PORT ?? "4000";
  return `http://localhost:${port}`;
}

/** 已是 http(s) 或 data: 的 URL 原样返回；相对 uploads 路径补全为公网绝对地址 */
export function toPublicAssetUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("data:")) {
    return trimmed;
  }
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (path.startsWith("/uploads/")) {
    return `${getApiPublicBase()}${path}`;
  }
  return trimmed;
}

export function toPublicAssetUrls(urls: string[]): string[] {
  return urls.map(toPublicAssetUrl);
}

/** 前端站点根 URL（邀请、分享、邮箱验证链接等） */
export function getPublicWebUrl() {
  return (
    process.env.PUBLIC_WEB_URL?.replace(/\/$/, "") ??
    process.env.APP_PUBLIC_URL?.replace(/\/$/, "") ??
    "http://localhost:3000"
  );
}
