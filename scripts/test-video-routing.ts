#!/usr/bin/env node
/**
 * 视频模型路由与可用性单测
 * pnpm --filter @aimarket/api exec tsx ../../scripts/test-video-routing.ts
 */
import {
  getVideoModelRoutes,
  resolveVideoModelRoute,
  resolveVideoProvider,
} from "../apps/api/src/providers/video/registry.ts";

const results: { name: string; pass: boolean; detail?: string }[] = [];

function ok(name: string, pass: boolean, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

function withEnv(
  env: Record<string, string | undefined>,
  fn: () => void,
): void {
  const prev: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(env)) {
    prev[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    fn();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

// 1) 生产典型：仅 Agnes，wan 不可用（禁止 Mock 假成功）
withEnv(
  {
    VIDEO_PROVIDER: "auto",
    AGNES_API_KEY: "sk-test",
    DASHSCOPE_API_KEY: undefined,
    VIDEO_API_URL: undefined,
  },
  () => {
    const wan = resolveVideoModelRoute("wan-2.6");
    ok("wan-2.6 无 DashScope/HTTP 时 unavailable", !wan.available, wan.provider);
    ok(
      "wan-2.6 不走 mock",
      resolveVideoProvider("wan-2.6").name === "unavailable",
    );

    const seedance = resolveVideoModelRoute("seedance-2");
    ok(
      "seedance-2 走 Agnes 代理",
      seedance.provider === "agnes-video" && seedance.available,
      seedance.routingHint ?? "",
    );

    const agnes = resolveVideoModelRoute("agnes-video");
    ok("agnes-video 可用", agnes.available && agnes.provider === "agnes-video");
    ok("agnes capabilities omni=image-only", agnes.capabilities.omni === "image-only");
  },
);

// 2) DASHSCOPE 时 wan 走 aliyun-wan-video
withEnv(
  {
    VIDEO_PROVIDER: "auto",
    AGNES_API_KEY: "sk-test",
    DASHSCOPE_API_KEY: "sk-dash",
    VIDEO_API_URL: undefined,
  },
  () => {
    const wan = resolveVideoModelRoute("wan-2.6");
    ok(
      "wan-2.6 + DASHSCOPE 可用",
      wan.provider === "aliyun-wan-video" && wan.available,
      wan.upstreamLabel,
    );
    ok(
      "wan capabilities full",
      wan.capabilities.omni === "full" && wan.capabilities.smartMultiFrame === "full",
    );
  },
);

// 3) HTTP 网关优先于万相/Agnes
withEnv(
  {
    VIDEO_PROVIDER: "auto",
    AGNES_API_KEY: "sk-test",
    DASHSCOPE_API_KEY: "sk-dash",
    VIDEO_API_URL: "https://video-gw.example.com",
  },
  () => {
    const seedance = resolveVideoModelRoute("seedance-2");
    ok(
      "seedance-2 + VIDEO_API_URL 优先 HTTP",
      seedance.provider === "http" && seedance.available,
    );
    const wan = resolveVideoModelRoute("wan-2.6");
    ok("wan-2.6 + VIDEO_API_URL 走 HTTP", wan.provider === "http" && wan.available);
  },
);

// 4) mock 模式
withEnv({ VIDEO_PROVIDER: "mock", AGNES_API_KEY: undefined }, () => {
  for (const id of ["agnes-video", "seedance-2", "wan-2.6"] as const) {
    const r = resolveVideoModelRoute(id);
    ok(`${id} mock 模式可用`, r.provider === "mock" && r.available);
  }
});

// 5) meta 列表覆盖三模型
withEnv({ VIDEO_PROVIDER: "auto", AGNES_API_KEY: "sk-test" }, () => {
  const routes = getVideoModelRoutes();
  ok("getVideoModelRoutes 含 3 项", routes.length === 3);
});

const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} 通过\n`);
process.exit(failed > 0 ? 1 : 0);
