#!/usr/bin/env node
/**
 * 生产环境复刻 analyze API 冒烟
 * PROD_EMAIL=... PROD_PASSWORD=... node scripts/verify-prod-drama-replicate.mjs
 */
const API = process.env.API_URL ?? "http://119.29.173.89:4100";

async function request(path, init = {}, token) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message ?? JSON.stringify(json);
    throw new Error(`${path}: ${msg} (HTTP ${res.status})`);
  }
  return json.data ?? json;
}

async function ensureToken() {
  if (process.env.PROD_SMOKE_TOKEN) return process.env.PROD_SMOKE_TOKEN;
  const email = process.env.PROD_EMAIL;
  const password = process.env.PROD_PASSWORD;
  if (!email || !password) {
    throw new Error("需要 PROD_SMOKE_TOKEN 或 PROD_EMAIL/PROD_PASSWORD");
  }
  const login = await request("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return login.token;
}

async function main() {
  const token = await ensureToken();
  const videoUrl = "https://example.com/reference/viral-short.mp4";
  const profile = await request(
    "/api/v1/drama/replicate/analyze",
    {
      method: "POST",
      body: JSON.stringify({ videoUrl }),
    },
    token,
  );

  if (profile.sourceUrl !== videoUrl) {
    throw new Error(`sourceUrl 不匹配: ${profile.sourceUrl}`);
  }
  if ((profile.beatStructure?.length ?? 0) < 3) {
    throw new Error("beatStructure 不足 3 条");
  }

  console.log(
    `✓ 生产复刻 analyze：beats=${profile.beatStructure.length} pacing=${profile.pacing ?? "—"}`,
  );
}

main().catch((err) => {
  console.error("✗", err.message);
  process.exit(1);
});
