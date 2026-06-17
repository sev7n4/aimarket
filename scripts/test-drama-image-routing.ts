/**
 * 短剧图像步 Auto 路由单测
 * pnpm exec tsx scripts/test-drama-image-routing.ts
 */
import {
  DRAMA_DEFAULT_IMAGE_MODEL_ID,
  dramaImageGenerationJobParams,
  resolveDramaImageModelId,
} from "../apps/api/src/lib/drama/image-job.ts";
import { inferRoutingModeFromJob } from "../apps/api/src/lib/generation-routing.ts";
import { listGenerateProviderCandidates } from "../apps/api/src/lib/image-routing.ts";

const results: { name: string; pass: boolean }[] = [];

function ok(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

ok(
  "default model is omni-v2 (auto chain)",
  DRAMA_DEFAULT_IMAGE_MODEL_ID === "omni-v2",
);

ok(
  "legacy agnes-image in project maps to omni-v2",
  resolveDramaImageModelId({
    productionParams: { imageModelId: "agnes-image" },
  }) === "omni-v2",
);

const autoParams = dramaImageGenerationJobParams(undefined);
ok("unset project uses auto routing", autoParams.routingMode === "auto");
ok("unset project autoRoute true", autoParams.autoRoute === true);

const inferred = inferRoutingModeFromJob({
  modelId: autoParams.modelId,
  routingMode: autoParams.routingMode,
  autoRoute: autoParams.autoRoute,
});
ok("job infers auto mode", inferred === "auto");

process.env.IMAGE_PROVIDER = "auto";
process.env.AGNES_API_KEY = "test-agnes";
process.env.DASHSCOPE_API_KEY = "test-wan";
process.env.ARK_API_KEY = "test-ark";

const candidates = listGenerateProviderCandidates(
  autoParams.modelId,
  false,
  {},
  { allowFallbackChain: true },
).map((p) => p.name);

ok(
  "char_refs t2i fallback chain starts with agnes and has multiple providers",
  candidates[0] === "agnes-image" && candidates.length >= 2,
);

const explicit = dramaImageGenerationJobParams({
  productionParams: { imageModelId: "seedream-5" },
});
ok(
  "user seedream-5 stays explicit",
  explicit.routingMode === "explicit" && explicit.modelId === "seedream-5",
);

const failed = results.filter((r) => !r.pass);
if (failed.length) {
  console.error("\nFailed:", failed.map((f) => f.name).join(", "));
  process.exit(1);
}
console.log(`\n${results.length} passed`);
