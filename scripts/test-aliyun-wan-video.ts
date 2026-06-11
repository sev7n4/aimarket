#!/usr/bin/env node
/**
 * 万相 2.7 视频 provider payload 单测（mock fetch）
 * pnpm --filter @aimarket/api exec tsx ../../scripts/test-aliyun-wan-video.ts
 */
import {
  aliyunWanVideoProvider,
  buildWanVideoPayloadForTest,
} from "../apps/api/src/providers/video/aliyun-wan-video.ts";

const results: { name: string; pass: boolean; detail?: string }[] = [];

function ok(name: string, pass: boolean, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

process.env.DASHSCOPE_API_KEY = "sk-test";

const t2v = buildWanVideoPayloadForTest({
  prompt: "猫咪奔跑",
  modelId: "wan-2.6",
  count: 1,
  resolution: "1k",
});
ok("文生视频 model", t2v.model === "wan2.7-t2v", String(t2v.model));

const i2v = buildWanVideoPayloadForTest({
  prompt: "过渡",
  modelId: "wan-2.6",
  count: 1,
  resolution: "1k",
  referenceMode: "first-last",
  videoReferences: [
    {
      assetId: "a",
      mediaType: "image",
      role: "first_frame",
      url: "https://example.com/f.png",
    },
    {
      assetId: "b",
      mediaType: "image",
      role: "last_frame",
      url: "https://example.com/l.png",
    },
  ],
});
ok("首尾帧 i2v", i2v.model === "wan2.7-i2v", String(i2v.model));
const i2vMedia = (i2v.input as { media?: { type: string }[] }).media ?? [];
ok(
  "首尾帧 media",
  i2vMedia.some((m) => m.type === "first_frame") &&
    i2vMedia.some((m) => m.type === "last_frame"),
);

const r2v = buildWanVideoPayloadForTest({
  prompt: "图1跳舞",
  modelId: "wan-2.6",
  count: 1,
  resolution: "1k",
  referenceMode: "omni",
  videoReferences: [
    {
      assetId: "a",
      mediaType: "image",
      url: "https://example.com/a.png",
    },
  ],
});
ok("全能 r2v", r2v.model === "wan2.7-r2v", String(r2v.model));

const omniAudio = buildWanVideoPayloadForTest({
  prompt: "配乐",
  modelId: "wan-2.6",
  count: 1,
  resolution: "1k",
  referenceMode: "omni",
  videoReferences: [
    {
      assetId: "img",
      mediaType: "image",
      url: "https://example.com/a.png",
    },
    {
      assetId: "aud",
      mediaType: "audio",
      url: "https://example.com/a.mp3",
    },
  ],
});
const omniMedia = (omniAudio.input as { media?: unknown[] }).media ?? [];
ok("全能 omni 忽略音频", omniMedia.length === 1);

const smart = buildWanVideoPayloadForTest({
  prompt: "故事",
  modelId: "wan-2.6",
  count: 1,
  resolution: "1k",
  referenceMode: "smart-multi-frame",
  smartMultiShots: [
    { order: 0, motionPrompt: "全景街景", url: "https://example.com/1.png" },
    { order: 1, motionPrompt: "特写表情" },
  ],
});
ok("智能多帧 t2v", smart.model === "wan2.7-t2v", String(smart.model));
ok(
  "智能多帧 prompt 含镜头",
  String((smart.input as { prompt?: string }).prompt).includes("第1个镜头"),
);

ok("provider supports wan-2.6", aliyunWanVideoProvider.supports("wan-2.6"));

const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} 通过\n`);
process.exit(failed > 0 ? 1 : 0);
