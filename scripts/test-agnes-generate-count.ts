/**
 * Agnes 多张出图请求规划单测
 * pnpm exec tsx scripts/test-agnes-generate-count.ts
 */
import { agnesGenerateRequestCount } from "../apps/api/src/providers/agnes-image.ts";

const results: { name: string; pass: boolean }[] = [];

function ok(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

ok("count 4 → 4 parallel slots", agnesGenerateRequestCount(4) === 4);
ok("count 0 clamps to 1", agnesGenerateRequestCount(0) === 1);
ok("count 9 caps at 4", agnesGenerateRequestCount(9) === 4);

const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} 通过\n`);
process.exit(failed > 0 ? 1 : 0);
