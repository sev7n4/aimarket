#!/usr/bin/env node
/**
 * 视频参考 prompt 单测
 * pnpm --filter @aimarket/api exec tsx ../../scripts/test-video-reference-prompt.ts
 */
import { buildVideoReferencePrompt } from "../apps/api/src/lib/video-references.ts";

const results: { name: string; pass: boolean }[] = [];

function ok(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

const withRef = buildVideoReferencePrompt("猫咪转头", [
  "http://example.com/a.png",
]);
ok("不含引用 URL 文本", !withRef.includes("http://example.com"));
ok("含图生视频指令", /图生视频/.test(withRef));
ok("保留用户 prompt", withRef.includes("猫咪转头"));

const plain = buildVideoReferencePrompt("纯文生", []);
ok("无参考图不变", plain === "纯文生");

const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} 通过\n`);
process.exit(failed > 0 ? 1 : 0);
