#!/usr/bin/env node
/**
 * 归档灵感画廊中无法播放的视频条目（metadata_user 坏链等）。
 * 用法：API_URL=http://119.29.173.89:4100 ADMIN_SECRET=... node scripts/archive-broken-inspiration-videos.mjs
 */
const API = (process.env.API_URL ?? "http://127.0.0.1:4000").replace(/\/$/, "");
const ADMIN = process.env.ADMIN_SECRET ?? "aimarket-admin-dev";

function suspect(url) {
  if (!url || typeof url !== "string") return false;
  return /metadata_user|metadata_/i.test(url);
}

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "x-admin-secret": ADMIN,
      ...(opts.headers ?? {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  return { res, json };
}

async function main() {
  const list = await api("/api/v1/admin/inspiration");
  if (!list.res.ok) {
    console.error("admin list failed", list.res.status, list.json);
    process.exit(1);
  }
  const rows = list.json?.data ?? [];
  const broken = rows.filter(
    (r) =>
      r.status === "published" &&
      (r.mediaType === "video" || /\.mp4/i.test(r.coverUrl ?? "")) &&
      (!r.videoUrl || suspect(r.videoUrl) || suspect(r.coverUrl)),
  );

  if (!broken.length) {
    console.log("No broken video inspirations to archive.");
    return;
  }

  console.log(`Found ${broken.length} broken video inspiration(s):`);
  for (const row of broken) {
    console.log(`  - ${row.id}  ${row.title}`);
    const del = await api(`/api/v1/admin/inspiration/${row.id}`, {
      method: "DELETE",
    });
    if (del.res.ok) {
      console.log(`    archived`);
    } else {
      console.error(`    failed`, del.res.status, del.json?.error?.message);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
