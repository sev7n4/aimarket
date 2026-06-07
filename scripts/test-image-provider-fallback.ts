/**
 * 图生图 Provider 回落与错误识别单测
 * pnpm --filter @aimarket/api exec tsx ../../scripts/test-image-provider-fallback.ts
 */
import { isRetriableI2iProviderError } from "../apps/api/src/lib/image-provider-fallback.ts";

const results: { name: string; pass: boolean }[] = [];

function ok(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

ok(
  "429 SetLimitExceeded retriable",
  isRetriableI2iProviderError(
    new Error(
      '火山方舟 Seedream 失败 (429): {"error":{"code":"SetLimitExceeded"}}',
    ),
  ),
);
ok("quota retriable", isRetriableI2iProviderError(new Error("quota exceeded")));
ok(
  "validation not retriable",
  !isRetriableI2iProviderError(new Error("prompt blocked by moderation")),
);

const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} 通过\n`);
process.exit(failed > 0 ? 1 : 0);
