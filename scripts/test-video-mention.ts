#!/usr/bin/env node
/**
 * 视频 @ 引用与 omni 校验单测
 * pnpm --filter @aimarket/api exec tsx ../../scripts/test-video-mention.ts
 */
import {
  assignOmniRefLabels,
  defaultOmniRefLabel,
  validateOmniVideoMentions,
  videoRefsToMentionCandidates,
} from "../apps/web/src/lib/video-mention.ts";

const results: { name: string; pass: boolean }[] = [];

function ok(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

ok(
  "defaultOmniRefLabel image",
  defaultOmniRefLabel("image", 0) === "图片1",
);
ok(
  "defaultOmniRefLabel video",
  defaultOmniRefLabel("video", 1) === "视频2",
);

const refs = assignOmniRefLabels([
  {
    assetId: "a1",
    mediaType: "image",
    role: "reference",
    previewUrl: "/uploads/a1.jpg",
  },
  {
    assetId: "a2",
    mediaType: "video",
    role: "reference",
    previewUrl: "/uploads/a2.mp4",
  },
]);
ok("assignOmniRefLabels", refs[0]?.label === "图片1" && refs[1]?.label === "视频1");

const candidates = videoRefsToMentionCandidates(refs);
ok("videoRefsToMentionCandidates count", candidates.length === 2);

ok(
  "validate missing @",
  validateOmniVideoMentions("纯文本", refs).ok === false,
);
ok(
  "validate with @",
  validateOmniVideoMentions("参考 @图片1 的主体", refs).ok === true,
);
ok(
  "validate unknown @",
  validateOmniVideoMentions("@图片9 不存在", refs).ok === false,
);
ok(
  "validate empty refs",
  validateOmniVideoMentions("", []).ok === true,
);

const failed = results.filter((r) => !r.pass);
if (failed.length) {
  console.error(`\n${failed.length} failed`);
  process.exit(1);
}
console.log(`\nAll ${results.length} passed`);
