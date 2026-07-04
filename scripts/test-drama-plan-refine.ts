/**
 * 多轮对话策划 — refine 迭代 + 对话回合（drama_plan_turns）
 * pnpm --filter @aimarket/api exec tsx ../../scripts/test-drama-plan-refine.ts
 *
 * 直接调用 lib 层（无需启动 API）。测试环境未开 LLM 时走规则引擎回退，
 * 因此仅断言「机制」：refine 原地更新同一 project、新增一条版本、回合被回填。
 */
import { randomUUID } from "node:crypto";
import { db } from "../apps/api/src/db/index.js";
import {
  createDramaProject,
  getDramaProject,
  parseProjectJson,
} from "../apps/api/src/lib/drama/projects.ts";
import { listDramaProjectVersions } from "../apps/api/src/lib/drama/project-versions.ts";
import { createDramaPlanRun, getDramaPlanRun } from "../apps/api/src/lib/drama/plan-runs.ts";
import { executeDramaPlanRefine } from "../apps/api/src/lib/drama/plan-executor.ts";
import {
  createPlanTurn,
  listPlanTurns,
  completePlanTurnByRun,
} from "../apps/api/src/lib/drama/plan-turns.ts";
import type { DramaProjectData } from "../apps/api/src/lib/drama/schema.ts";

const results: { name: string; pass: boolean; detail?: string }[] = [];
function ok(name: string, pass: boolean, detail?: string) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

function createVerifiedUser(): string {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO users (id, email, password_hash, credits, email_verified_at)
     VALUES (?, ?, 'hash', 10000, datetime('now'))`,
  ).run(id, `refine-${id.slice(0, 8)}@test.local`);
  return id;
}

function createSession(userId: string): string {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO image_sessions (id, user_id, title, mode, status)
     VALUES (?, ?, 'refine-test', 'chat', 'idle')`,
  ).run(id, userId);
  return id;
}

function buildProject(title: string): DramaProjectData {
  return {
    projectType: "short_drama",
    userIdea: "外卖小哥重生成癞蛤蟆，吞噬灵石进化成吞天巨兽，参考山海经异兽",
    targetDurationSec: 90,
    script: { title, logline: "重生逆袭", acts: [], narratorLines: [] },
    styleBible: {
      palette: ["warm"],
      lightingStyle: "soft",
      aspectRatio: "9:16",
      negativePrompt: "",
    },
    characters: [],
    scenes: [],
    shots: [],
    productionParams: { previewTier: "low", aspectRatio: "9:16" },
  };
}

async function main() {
console.log("\n=== 多轮对话策划 refine + turns ===\n");

const userId = createVerifiedUser();
const sessionId = createSession(userId);

// 1. 建初始项目（自动 initial 版本）
const projectRow = createDramaProject({
  sessionId,
  userId,
  project: buildProject("v1 初始方案"),
});
let versions = listDramaProjectVersions(userId, projectRow.id);
ok("1. 初始项目仅 1 个 initial 版本", versions.length === 1, `实际=${versions.length}`);

// 2. 创建 refine plan run（携带指令 + baseProjectId）
const instruction = "增加几个女性二主角和老人配角，场景更丰富";
const run = createDramaPlanRun({
  sessionId,
  userId,
  userIdea: buildProject("v1 初始方案").userIdea,
  refineInstruction: instruction,
  baseProjectId: projectRow.id,
});
ok("2. refine run 复用 project_id", run.project_id === projectRow.id);
ok("3. refine run 记录 refine_instruction", run.refine_instruction === instruction);

// 3. 路由会先写一条 refine 回合（此处手动模拟）
const turn = createPlanTurn({
  sessionId,
  userId,
  kind: "refine",
  instruction,
  planRunId: run.id,
  projectId: projectRow.id,
  assistantAck: "收到！正在迭代……",
});
ok("4. refine 回合初始 version_id 为空", turn.version_id === null);

// 4. 执行 refine（测试环境走规则引擎回退，但机制一致）
await executeDramaPlanRefine(run.id, userId);

const finished = getDramaPlanRun(userId, run.id)!;
ok("5. refine run 完成", finished.status === "completed", `status=${finished.status}`);
ok("6. refine 未新建 project（原地更新）", finished.project_id === projectRow.id);

// 5. 版本 +1
versions = listDramaProjectVersions(userId, projectRow.id);
ok("7. refine 后版本数=2", versions.length === 2, `实际=${versions.length}`);
ok("8. 最新版本 note=指令", versions[0].note === instruction, `note=${versions[0].note}`);
ok("9. 最新版本 isCurrent", versions[0].isCurrent === true);

// 6. 回合被回填 version_id + project_id
const turns = listPlanTurns(userId, sessionId);
const refineTurn = turns.find((t) => t.id === turn.id)!;
ok("10. 回合列表可查到 refine 回合", !!refineTurn && refineTurn.kind === "refine");
ok(
  "11. refine 回合回填了最新 version_id",
  refineTurn.version_id === versions[0].id,
  `version_id=${refineTurn.version_id}`,
);
ok("12. refine 回合 project_id 正确", refineTurn.project_id === projectRow.id);

// 7. 项目仍可正常解析
const current = parseProjectJson(getDramaProject(userId, projectRow.id)!);
ok("13. 迭代后项目 JSON 可解析且有标题", !!current.script.title);

// 8. plan-turns 基础能力：completePlanTurnByRun 幂等 + kind=initial
const initialRun = createDramaPlanRun({
  sessionId,
  userId,
  userIdea: "另一条初始",
});
const initialTurn = createPlanTurn({
  sessionId,
  userId,
  kind: "initial",
  instruction: "另一条初始",
  planRunId: initialRun.id,
});
completePlanTurnByRun(initialRun.id, { projectId: projectRow.id, versionId: versions[0].id });
const finalTurns = listPlanTurns(userId, sessionId);
const reloaded = finalTurns.find((t) => t.id === initialTurn.id)!;
ok("14. initial 回合可被 completePlanTurnByRun 回填", reloaded.version_id === versions[0].id);
const ascending = finalTurns.every(
  (t, i) => i === 0 || finalTurns[i - 1].created_at <= t.created_at,
);
ok(
  "15. 回合按时间升序返回",
  finalTurns.length >= 2 && ascending,
  `count=${finalTurns.length}`,
);

console.log("\n=== 总结 ===");
const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass).length;
console.log(`${passed}/${results.length} 通过，${failed} 失败`);
if (failed > 0) {
  console.log("\n失败项：");
  for (const r of results.filter((r) => !r.pass)) {
    console.log(`  ✗ ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
  }
  process.exit(1);
}
}

main().catch((err) => {
  console.error("✗", err);
  process.exit(1);
});
