/**
 * 图像 Provider 回落与错误识别单测
 * pnpm --filter @aimarket/api exec tsx ../../scripts/test-image-provider-fallback.ts
 */
import { isRetriableGenerateProviderError } from "../apps/api/src/lib/image-provider-fallback.ts";
import {
  generateFallbackOrder,
  listGenerateProviderCandidates,
} from "../apps/api/src/lib/image-routing.ts";

const results: { name: string; pass: boolean }[] = [];

function ok(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

ok(
  "429 SetLimitExceeded retriable",
  isRetriableGenerateProviderError(
    new Error(
      '火山方舟 Seedream 失败 (429): {"error":{"code":"SetLimitExceeded"}}',
    ),
  ),
);
ok(
  "quota retriable",
  isRetriableGenerateProviderError(new Error("quota exceeded")),
);
ok(
  "validation not retriable",
  !isRetriableGenerateProviderError(new Error("prompt blocked by moderation")),
);
ok(
  "Agnes 500 upstream_error retriable",
  isRetriableGenerateProviderError(
    new Error(
      'Agnes Image 失败 (500): {"error":{"type":"upstream_error","code":"500"}}',
    ),
  ),
);
ok(
  "502 retriable",
  isRetriableGenerateProviderError(new Error("provider timeout (502)")),
);

ok(
  "default fallback order Agnes → wan → Seedream",
  generateFallbackOrder().join(",") ===
    "agnes-image,aliyun-wan,seedream-image",
);

process.env.IMAGE_PROVIDER = "auto";
process.env.AGNES_API_KEY = "test-agnes";
process.env.DASHSCOPE_API_KEY = "test-wan";
process.env.ALIYUN_WAN_I2I_MODEL = "wan2.6-image-to-image";
process.env.ARK_API_KEY = "test-ark";
const t2iCandidates = listGenerateProviderCandidates("omni-v2", false).map(
  (p) => p.name,
);
const i2iCandidates = listGenerateProviderCandidates("omni-v2", true).map(
  (p) => p.name,
);
ok(
  "t2i candidates start with Agnes",
  t2iCandidates.slice(0, 3).join(",") ===
    "agnes-image,aliyun-wan,seedream-image",
);
ok(
  "i2i candidates start with Agnes",
  i2iCandidates.slice(0, 3).join(",") ===
    "agnes-image,aliyun-wan,seedream-image",
);

const explicitSeedream = listGenerateProviderCandidates(
  "seedream-5",
  false,
  {},
  { allowFallbackChain: false },
).map((p) => p.name);
ok(
  "explicit seedream-5 uses single provider",
  explicitSeedream.length === 1 && explicitSeedream[0] === "seedream-image",
);

const autoAlias = listGenerateProviderCandidates(
  "latest-v2-pro",
  true,
  {},
  { allowFallbackChain: true },
).map((p) => p.name);
ok(
  "auto route alias uses fallback chain",
  autoAlias.slice(0, 3).join(",") ===
    "agnes-image,aliyun-wan,seedream-image",
);

const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} 通过\n`);
process.exit(failed > 0 ? 1 : 0);
