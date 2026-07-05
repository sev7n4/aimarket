/**
 * 提示词润色路由与上下文 system prompt 单测
 * pnpm --filter @aimarket/api exec tsx ../../scripts/test-prompt-optimize.ts
 */
import {
  buildOptimizeSystemPrompt,
  dedupeCandidates,
  resolveDirection,
} from "../apps/api/src/lib/prompt-optimize/context.ts";
import {
  optimizePrompt,
  resolveEffectiveCandidateCount,
} from "../apps/api/src/lib/prompt-optimize/index.ts";

const results: { name: string; pass: boolean }[] = [];

function ok(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

const withRefs = buildOptimizeSystemPrompt("image", {
  hasReferenceImages: true,
  aspectRatio: "16:9",
  modelId: "seedream-5",
});
ok(
  "context includes reference + aspect + model hints",
  /参考图/.test(withRefs) &&
    /16:9/.test(withRefs) &&
    /写实/.test(withRefs),
);

const template = optimizePrompt("image", "红色杯子");
ok("template fallback works", template.includes("红色杯子"));

// ── 意图条件化系统提示词 ────────────────────────────────────────────────
const baseline = buildOptimizeSystemPrompt("image");
ok(
  "no intentSignal -> baseline BASE_SYSTEM unchanged",
  baseline.includes("图片模式提示词助手"),
);

const editPrompt = buildOptimizeSystemPrompt("image", {
  intentSignal: "image-edit",
});
ok(
  "image-edit persona has local-edit constraints",
  /局部编辑/.test(editPrompt) &&
    /仅修改用户指定区域/.test(editPrompt) &&
    /不要整体重画/.test(editPrompt),
);

const expandPrompt = buildOptimizeSystemPrompt("image", {
  intentSignal: "image-expand",
});
ok(
  "image-expand persona keeps perspective continuity",
  /扩图/.test(expandPrompt) && /透视/.test(expandPrompt),
);

const v2iPrompt = buildOptimizeSystemPrompt("image", {
  intentSignal: "video-from-image",
});
ok(
  "video-from-image persona keeps first-frame consistency",
  /图生视频/.test(v2iPrompt) && /首帧/.test(v2iPrompt),
);

const unknownSignal = buildOptimizeSystemPrompt("image", {
  intentSignal: "totally-unknown",
});
ok(
  "unknown intentSignal -> falls back to BASE_SYSTEM",
  unknownSignal.includes("图片模式提示词助手"),
);

// ── 方向解析 ────────────────────────────────────────────────────────────
ok(
  "resolveDirection uses intentSignal label",
  resolveDirection("image", { intentSignal: "image-edit" }).label === "局部编辑",
);
ok(
  "resolveDirection falls back to mode default",
  resolveDirection("image").direction === "image-generate",
);
ok(
  "resolveDirection ecommerce label",
  resolveDirection("ecommerce").label === "电商视觉",
);

// ── 候选去重 ────────────────────────────────────────────────────────────
ok(
  "dedupeCandidates trims + drops empty + dedupes, keeps order",
  JSON.stringify(dedupeCandidates([" A ", "A", "", "B", "  "])) ===
    JSON.stringify(["A", "B"]),
);

// ── DeepSeek 候选数限制 ───────────────────────────────────────────────────
const prevBase = process.env.OPENAI_BASE_URL;
process.env.OPENAI_BASE_URL = "https://api.deepseek.com/v1";
ok(
  "deepseek endpoint caps candidate count to 1",
  resolveEffectiveCandidateCount(3) === 1,
);
process.env.OPENAI_BASE_URL = prevBase;
ok(
  "non-deepseek keeps requested candidate count",
  resolveEffectiveCandidateCount(3) === 3,
);

console.log(`\n${results.filter((r) => r.pass).length}/${results.length} 通过`);
if (results.some((r) => !r.pass)) process.exit(1);
