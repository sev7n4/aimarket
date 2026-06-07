/**
 * source_lane 推断单测（Skill 步骤 + 通用 infer）
 * pnpm --filter @aimarket/api exec tsx ../../scripts/test-source-lane.ts
 */
import {
  inferSkillStepSourceLane,
  inferSourceLane,
  parseSourceLane,
} from "../apps/api/src/lib/source-lane.ts";

const results: { name: string; pass: boolean; detail?: string }[] = [];

function ok(name: string, pass: boolean, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

ok("parseSourceLane image", parseSourceLane("image") === "image");
ok("parseSourceLane invalid", parseSourceLane("skill") === null);

ok(
  "inferSourceLane explicit",
  inferSourceLane({ sourceLane: "agent", toolType: "video" }) === "agent",
);
ok(
  "inferSourceLane video tool",
  inferSourceLane({ toolType: "video" }) === "video",
);
ok("inferSourceLane default null", inferSourceLane({}) === null);

ok(
  "skill generate_set → agent",
  inferSkillStepSourceLane({ type: "generate_set" }) === "agent",
);
ok("skill tool → agent", inferSkillStepSourceLane({ type: "tool" }) === "agent");
ok(
  "skill video → video",
  inferSkillStepSourceLane({ type: "video" }) === "video",
);

const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} 通过\n`);
process.exit(failed > 0 ? 1 : 0);
