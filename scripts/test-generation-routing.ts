/**
 * 生成路由语义单测（routingMode + qualityTier）
 * pnpm exec tsx scripts/test-generation-routing.ts
 */
import {
  inferRoutingModeFromJob,
  isInternalRoutingModelId,
  legacyModelIdToQualityTier,
  qualityTierToLegacyModelId,
  resolveRoutingModelId,
} from "../apps/api/src/lib/generation-routing.ts";
import { suggestModel } from "../apps/api/src/lib/router.ts";

const results: { name: string; pass: boolean }[] = [];

function ok(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

ok(
  "qualityTier standard → omni-v2",
  qualityTierToLegacyModelId("standard") === "omni-v2",
);
ok(
  "qualityTier pro → latest-v2-pro",
  qualityTierToLegacyModelId("pro") === "latest-v2-pro",
);
ok(
  "legacy pro → qualityTier",
  legacyModelIdToQualityTier("latest-v2-pro") === "pro",
);
ok(
  "auto resolve uses qualityTier",
  resolveRoutingModelId({
    routingMode: "auto",
    qualityTier: "pro",
  }) === "latest-v2-pro",
);
ok(
  "explicit resolve uses model id",
  resolveRoutingModelId({
    routingMode: "explicit",
    explicitModelId: "seedream-5",
  }) === "seedream-5",
);
ok(
  "byok resolve uses dall-e-3",
  resolveRoutingModelId({
    routingMode: "byok",
    explicitModelId: "dall-e-3",
  }) === "dall-e-3",
);
ok(
  "infer from routingMode field",
  inferRoutingModeFromJob({ routingMode: "byok", autoRoute: true }) ===
    "byok",
);
ok(
  "infer auto from autoRoute flag",
  inferRoutingModeFromJob({ autoRoute: true, modelId: "omni-v2" }) === "auto",
);
ok(
  "infer explicit for user model",
  inferRoutingModeFromJob({ modelId: "agnes-image" }) === "explicit",
);
ok(
  "internal routing ids",
  isInternalRoutingModelId("omni-v2") &&
    isInternalRoutingModelId("latest-v2-pro") &&
    !isInternalRoutingModelId("seedream-5"),
);

const imageSuggestion = suggestModel("image", "画一只猫");
ok(
  "suggestModel image → auto + standard",
  imageSuggestion.routingMode === "auto" &&
    imageSuggestion.qualityTier === "standard" &&
    imageSuggestion.modelId === "omni-v2",
);

const ecommerceSuggestion = suggestModel("ecommerce", "商品主图");
ok(
  "suggestModel ecommerce → auto + pro",
  ecommerceSuggestion.routingMode === "auto" &&
    ecommerceSuggestion.qualityTier === "pro" &&
    ecommerceSuggestion.modelId === "latest-v2-pro",
);

const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} 通过\n`);
process.exit(failed > 0 ? 1 : 0);
