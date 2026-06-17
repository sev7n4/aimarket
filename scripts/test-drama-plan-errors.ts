/**
 * 规划错误文案单测
 * pnpm exec tsx scripts/test-drama-plan-errors.ts
 */
import { formatDramaPlanError } from "../apps/api/src/lib/drama/plan-errors.ts";

const results: { name: string; pass: boolean }[] = [];

function ok(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

ok(
  "strips Arrearage JSON",
  formatDramaPlanError(
    '[qwen] LLM 400: {"error":{"type":"Arrearage","message":"Access denied"}}',
  ).includes("欠费"),
);

ok(
  "no raw JSON in output",
  !formatDramaPlanError(
    '[qwen] LLM 400: {"code":"Arrearage"}',
  ).includes("{"),
);

ok(
  "generic LLM",
  formatDramaPlanError("[qwen] LLM 429 rate limit").includes("暂时不可用"),
);

const failed = results.filter((r) => !r.pass);
if (failed.length) {
  console.error("\nFailed:", failed.map((f) => f.name).join(", "));
  process.exit(1);
}
console.log(`\n${results.length} passed`);
