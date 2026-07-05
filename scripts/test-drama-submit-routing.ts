/**
 * 短剧提交路由：车道隔离
 * pnpm --filter @aimarket/web exec tsx ../../scripts/test-drama-submit-routing.ts
 */
import {
  isDramaIntentPrompt,
  shouldUseDramaOrchestration,
} from "../apps/web/src/lib/drama-submit-routing.ts";

const DRAMA_SKILL_ID = "drama-short-v1";

const results: { name: string; pass: boolean }[] = [];
function ok(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

ok("短剧意图识别", isDramaIntentPrompt("帮我写一个都市短剧剧本"));
ok("非短剧意图", !isDramaIntentPrompt("一只猫在月球上"));

const base = {
  activeSkillId: null as string | null,
  prompt: "hello",
  effectiveMode: "chat" as const,
  hasDramaSessionState: true,
};

ok(
  "图片车道不走短剧（即使有会话状态）",
  !shouldUseDramaOrchestration({ ...base, creationLane: "image" }),
);
ok(
  "视频车道不走短剧（即使有会话状态）",
  !shouldUseDramaOrchestration({ ...base, creationLane: "video" }),
);
ok(
  "Agent + production 走短剧",
  shouldUseDramaOrchestration({
    ...base,
    creationLane: "agent",
    effectiveMode: "production",
  }),
);
ok(
  "Agent + 短剧意图走短剧",
  shouldUseDramaOrchestration({
    ...base,
    creationLane: "agent",
    hasDramaSessionState: false,
    prompt: "写一个短剧",
  }),
);
ok(
  "Agent + 显式短剧 skill",
  shouldUseDramaOrchestration({
    ...base,
    creationLane: "agent",
    activeSkillId: DRAMA_SKILL_ID,
    hasDramaSessionState: false,
  }),
);

const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} 通过\n`);
process.exit(failed > 0 ? 1 : 0);
