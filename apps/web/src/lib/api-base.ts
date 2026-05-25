/** 解析浏览器端 API 根地址；生产构建若 NEXT_PUBLIC_API_URL 缺 host 则回退到当前页同 host:4100 */
export function resolveApiBase(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (fromEnv && isValidApiBase(fromEnv)) {
    return fromEnv;
  }
  if (typeof window !== "undefined" && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:4100`;
  }
  return "http://localhost:4000";
}

function isValidApiBase(url: string): boolean {
  try {
    const u = new URL(url);
    return Boolean(u.hostname);
  } catch {
    return false;
  }
}
