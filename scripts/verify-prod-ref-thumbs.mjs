#!/usr/bin/env node
/**
 * 生产复测：视频参考缩略图 / 灵感视频 / 画布挑选（不打印 token）
 * 用法：PROD_EMAIL=... PROD_PASSWORD=... node scripts/verify-prod-ref-thumbs.mjs
 */
const API = process.env.API_URL ?? "http://119.29.173.89:4100";
const WEB = process.env.WEB_URL ?? "http://119.29.173.89:3100";
const EMAIL = process.env.PROD_EMAIL ?? "user001@163.com";
const PASSWORD = process.env.PROD_PASSWORD ?? "11111111";
const SESSION_ID =
  process.env.SESSION_ID ?? "e16c5f5b-95c6-4553-800c-b61cac93982e";

const results = [];

function pass(id, detail) {
  results.push({ id, ok: true, detail });
  console.log(`✓ ${id}: ${detail}`);
}
function fail(id, detail) {
  results.push({ id, ok: false, detail });
  console.log(`✗ ${id}: ${detail}`);
}

async function api(path, { token, method = "GET", body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60_000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${method} ${path} ${res.status}: ${json.message ?? JSON.stringify(json).slice(0, 200)}`);
  }
  return json.data ?? json;
}

function isImageUrl(url) {
  return /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url);
}
function isVideoUrl(url) {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url);
}

async function main() {
  console.log(`\n生产复测 @ ${API}\n`);

  let token;
  try {
    const login = await api("/api/v1/auth/login", {
      method: "POST",
      body: { email: EMAIL, password: PASSWORD },
    });
    token = login.token;
    pass("AUTH", "登录成功");
  } catch (e) {
    fail("AUTH", e.message);
    process.exit(1);
  }

  // 灵感画廊：视频条目 cover / videoUrl
  try {
    const page = await api("/api/v1/inspiration/page?page=1&pageSize=40", { token });
    const items = page.rows ?? page.items ?? page.list ?? [];
    const videos = items.filter(
      (i) =>
        i.mediaType === "video" ||
        isVideoUrl(i.coverUrl ?? "") ||
        isVideoUrl(i.videoUrl ?? ""),
    );
    const withPoster = videos.filter((i) => {
      const cover = i.coverUrl ?? "";
      return cover && isImageUrl(cover);
    });
    const withPlayable = videos.filter((i) => {
      const v = i.videoUrl ?? i.coverUrl ?? "";
      return v && isVideoUrl(v) && !v.includes("metadata_user");
    });
    const broken = videos.filter((i) => {
      const v = i.videoUrl ?? i.coverUrl ?? "";
      return v.includes("metadata_user") || (isVideoUrl(v) && !i.videoUrl);
    });
    pass(
      "INSPIRATION-LIST",
      `共 ${items.length} 条，视频 ${videos.length}，poster图 ${withPoster.length}，可播 ${withPlayable.length}，疑似坏链 ${broken.length}`,
    );
    if (videos.length > 0) {
      const sample = videos[0];
      const detail = await api(`/api/v1/inspiration/${sample.id}`, { token });
      const cover = detail.coverUrl ?? "";
      const videoUrl = detail.videoUrl ?? "";
      if (detail.mediaType === "video" || isVideoUrl(cover) || isVideoUrl(videoUrl)) {
        if (isImageUrl(cover) || (videoUrl && isVideoUrl(videoUrl))) {
          pass("INSPIRATION-DETAIL", `id=${detail.id} title=${detail.title?.slice(0, 20)} cover=${isImageUrl(cover) ? "poster" : cover.slice(0, 40)} video=${videoUrl ? "yes" : "no"}`);
        } else if (cover.includes("metadata_user")) {
          fail("INSPIRATION-DETAIL", `id=${detail.id} 仍为历史坏链，需重新发布`);
        } else {
          fail("INSPIRATION-DETAIL", `id=${detail.id} 无有效 poster/videoUrl`);
        }
      }
    }
  } catch (e) {
    fail("INSPIRATION-LIST", e.message);
  }

  // 画布 bundle：是否有可挑选素材
  try {
    await api("/api/v1/imageSession/ensure", {
      token,
      method: "POST",
      body: { sessionId: SESSION_ID, mode: "chat", kind: "canvas" },
    });
    const bundle = await api(
      `/api/v1/imageSession/${SESSION_ID}/canvas-bundle`,
      { token },
    );
    const layoutItems = bundle.layout?.items ?? [];
    const msgOutputs = (bundle.messages ?? []).flatMap((m) => m.outputs ?? []);
    const fromMessages = msgOutputs
      .filter((o) => o.url && !/\.(mp4|webm|mov)(\?|$)/i.test(o.url))
      .map((o, i) => ({
        url: o.url,
        assetId: o.assetId,
        outputId: o.id ?? o.outputId,
        label: `生成图${i + 1}`,
      }));
    const outputs = [
      ...layoutItems.filter((i) => i.url && !i.isVideo),
      ...fromMessages,
    ];
    const withAsset = outputs.filter((i) => i.assetId);
    const withoutAsset = outputs.filter((i) => !i.assetId);
    pass(
      "CANVAS-BUNDLE",
      `画布图 ${outputs.length}（有 assetId ${withAsset.length}，仅 outputId ${withoutAsset.length}）`,
    );

    if (withoutAsset.length > 0) {
      const item = withoutAsset[0];
      const reg = await api("/api/v1/assets/register-url", {
        token,
        method: "POST",
        body: {
          sessionId: SESSION_ID,
          url: item.url.startsWith("http") ? item.url : `${API}${item.url}`,
          fileName: item.label ?? "canvas-pick-test.jpg",
        },
      });
      if (reg.id && reg.url) {
        pass("REGISTER-URL", `无 assetId 画布图可登记 assetId=${reg.id}`);
      } else {
        fail("REGISTER-URL", "登记返回缺少 id/url");
      }
    } else if (withAsset.length > 0) {
      pass("REGISTER-URL", "已有 assetId 画布图可直接进槽位");
    } else {
      fail("CANVAS-PICK", "会话无画布图，无法验证「从画布选择」");
    }
  } catch (e) {
    fail("CANVAS-BUNDLE", e.message);
  }

  // 上传探针：图/音/视 MIME 登记
  const probes = [
    {
      id: "PROBE-IMAGE",
      url: "https://picsum.photos/seed/aimarket-probe/320/180",
      fileName: "probe.jpg",
      expect: "image",
    },
  ];
  for (const p of probes) {
    try {
      const reg = await api("/api/v1/assets/register-url", {
        token,
        method: "POST",
        body: {
          sessionId: SESSION_ID,
          url: p.url,
          fileName: p.fileName,
        },
      });
      const mime = reg.mimeType ?? "";
      if (p.expect === "image" && mime.startsWith("image/")) {
        pass(p.id, `mime=${mime}`);
      } else {
        fail(p.id, `mime=${mime || "unknown"}`);
      }
    } catch (e) {
      fail(p.id, e.message);
    }
  }

  console.log(`\nStudio 手测入口: ${WEB}/studio?sessionId=${SESSION_ID}`);
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} 通过`);
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
