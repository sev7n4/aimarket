/**
 * 提示词润色路由与上下文 system prompt 单测
 * pnpm --filter @aimarket/api exec tsx ../../scripts/test-prompt-optimize.ts
 */
import { buildOptimizeSystemPrompt } from "../apps/api/src/lib/prompt-optimize/context.ts";
import { optimizePrompt } from "../apps/api/src/lib/prompt-optimize/index.ts";

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

console.log(`\n${results.filter((r) => r.pass).length}/${results.length} 通过`);
if (results.some((r) => !r.pass)) process.exit(1);
