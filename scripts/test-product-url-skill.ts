/**
 * product-url-v1 Skill 定义与 executor 步骤类型校验
 * pnpm exec tsx scripts/test-product-url-skill.ts
 */
import { loadSkill } from "../packages/agent-skills/src/index.js";
import { estimateSkillPoints } from "../apps/api/src/lib/agent/skill-runs.js";

const results: { name: string; pass: boolean }[] = [];

function ok(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

const skill = loadSkill("product-url-v1");
ok("loadSkill product-url-v1", skill.id === "product-url-v1");

const stepTypes = skill.steps.map((s) => s.type);
ok(
  "步骤类型完整",
  stepTypes.join(",") ===
    "tool,generate_set,shot_video_batch,music_gen,concat",
);

const scrape = skill.steps.find((s) => s.id === "scrape");
ok(
  "scrape 使用 url-scraper",
  scrape?.type === "tool" &&
    "toolId" in scrape &&
    scrape.toolId === "url-scraper",
);

const shotVideos = skill.steps.find((s) => s.id === "shot_videos");
ok(
  "shot_videos 引用 gen_set",
  shotVideos?.type === "shot_video_batch" &&
    "sourceStep" in shotVideos &&
    shotVideos.sourceStep === "gen_set",
);

const finalEdit = skill.steps.find((s) => s.id === "final_edit");
ok(
  "final_edit concat 含 shot_videos + bgm",
  finalEdit?.type === "concat" &&
    "sourceSteps" in finalEdit &&
    finalEdit.sourceSteps?.includes("shot_videos") &&
    finalEdit.sourceSteps?.includes("bgm"),
);

const points = estimateSkillPoints(skill);
ok("estimateSkillPoints > 0", points > 0);

const failed = results.filter((r) => !r.pass);
if (failed.length) {
  console.error(`\n${failed.length} 项失败`);
  process.exit(1);
}
console.log(`\n全部 ${results.length} 项通过`);
