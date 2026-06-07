/**
 * 画布批次模型/出图展示文案单测
 * pnpm exec tsx scripts/test-generation-display.ts
 */
import {
  formatBatchImageProvider,
  formatBatchModelSelection,
  isByokGeneration,
} from "../apps/web/src/lib/format-generation-display.ts";

const results: { name: string; pass: boolean }[] = [];

function ok(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

ok(
  "internal alias shows Auto",
  formatBatchModelSelection({ modelId: "latest-v2-pro", autoRoute: true }) ===
    "Auto",
);

ok(
  "explicit seedream shows product name",
  formatBatchModelSelection({ modelId: "seedream-5", autoRoute: false }) ===
    "Seedream 5",
);

ok(
  "BYOK model line",
  formatBatchModelSelection({
    modelId: "dall-e-3",
    imageProvider: "openai",
  }) === "Auto (BYOK)",
);

ok(
  "BYOK provider line",
  formatBatchImageProvider({
    modelId: "dall-e-3",
    imageProvider: "openai",
  }) === "DALL·E 3 · 您的 API Key",
);

ok(
  "auto + agnes provider",
  formatBatchImageProvider({
    modelId: "omni-v2",
    autoRoute: true,
    imageProvider: "agnes-image",
  }) === "Agnes Image",
);

ok(
  "explicit seedream hides redundant provider",
  formatBatchImageProvider({
    modelId: "seedream-5",
    imageProvider: "seedream-image",
  }) === null,
);

ok(
  "BYOK detector",
  isByokGeneration({ modelId: "dall-e-3", imageProvider: "openai" }),
);

const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} 通过\n`);
process.exit(failed > 0 ? 1 : 0);
