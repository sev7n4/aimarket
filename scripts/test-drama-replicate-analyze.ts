/**
 * 爆款复刻 analyze API（PROD-B04）
 * pnpm --filter @aimarket/api exec tsx ../../scripts/test-drama-replicate-analyze.ts
 */
import {
  analyzeReferenceVideo,
  formatReplicateProfileForPlanner,
  replicateProfileSchema,
} from "../apps/api/src/lib/drama/replicate.ts";

const results: { name: string; pass: boolean }[] = [];

function ok(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

async function main() {
  const profile = await analyzeReferenceVideo(
    "https://example.com/reference/viral-short.mp4",
  );
  ok("analyze returns profile", Boolean(profile.sourceUrl));
  ok("schema validates", replicateProfileSchema.safeParse(profile).success);
  ok("beat structure non-empty", profile.beatStructure.length >= 3);
  const block = formatReplicateProfileForPlanner(profile);
  ok("planner block mentions replicate", block.includes("爆款复刻参考"));

  const failed = results.filter((r) => !r.pass);
  if (failed.length) {
    console.error("\nFailed:", failed.map((f) => f.name).join(", "));
    process.exit(1);
  }
  console.log(`\n${results.length} passed`);
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
