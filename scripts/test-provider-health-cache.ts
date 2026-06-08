/**
 * Provider 探活缓存单测
 * pnpm --filter @aimarket/api exec tsx ../../scripts/test-provider-health-cache.ts
 */
import {
  classifyProviderError,
  clearProviderHealthCache,
  getCachedProviderHealth,
  recordProviderHealthFailure,
  setCachedProviderHealth,
} from "../apps/api/src/lib/provider-health-cache.ts";
import { assertToolProviderReady } from "../apps/api/src/lib/tool-preflight.ts";

const results: { name: string; pass: boolean }[] = [];

function ok(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

clearProviderHealthCache();

ok(
  "classify 429",
  classifyProviderError('火山方舟 Seedream 失败 (429): SetLimitExceeded') ===
    "quota_error",
);

ok(
  "classify 401",
  classifyProviderError("DashScope 鉴权失败 (401): InvalidApiKey", 401) ===
    "auth_error",
);

recordProviderHealthFailure(
  "tool-seedream",
  "火山方舟 Seedream 失败 (429): SetLimitExceeded",
);
const cached = getCachedProviderHealth("tool-seedream");
ok("record failure caches quota", cached?.status === "quota_error");

const prevGlobal = process.env.TOOL_IMAGE_PROVIDER;
const prevArk = process.env.ARK_API_KEY;
const prevCutout = process.env.TOOL_CUTOUT_PROVIDER;

try {
  process.env.TOOL_IMAGE_PROVIDER = "auto";
  process.env.ARK_API_KEY = "test-key";
  process.env.TOOL_CUTOUT_PROVIDER = "seedream";

  let blocked = false;
  try {
    assertToolProviderReady("cutout");
  } catch (e) {
    blocked = e instanceof Error && /配额已满|暂不可用/.test(e.message);
  }
  ok("assert blocks on negative cache", blocked);

  clearProviderHealthCache();
  setCachedProviderHealth("tool-seedream", "ok");
  ok(
    "assert passes on positive cache without probe",
    assertToolProviderReady("cutout").providerName === "tool-seedream",
  );
} finally {
  clearProviderHealthCache();
  if (prevGlobal === undefined) delete process.env.TOOL_IMAGE_PROVIDER;
  else process.env.TOOL_IMAGE_PROVIDER = prevGlobal;
  if (prevArk === undefined) delete process.env.ARK_API_KEY;
  else process.env.ARK_API_KEY = prevArk;
  if (prevCutout === undefined) delete process.env.TOOL_CUTOUT_PROVIDER;
  else process.env.TOOL_CUTOUT_PROVIDER = prevCutout;
}

const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} 通过\n`);
process.exit(failed > 0 ? 1 : 0);
