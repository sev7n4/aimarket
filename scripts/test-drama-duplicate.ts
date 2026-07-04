/**
 * 多轮对话策划 — 项目深拷贝（duplicate）
 * pnpm --filter @aimarket/api exec tsx ../../scripts/test-drama-duplicate.ts
 */
import { randomUUID } from "node:crypto";
import { db } from "../apps/api/src/db/index.js";
import {
  createDramaProject,
  duplicateDramaProject,
  getDramaProject,
  parseProjectJson,
  updateDramaProject,
} from "../apps/api/src/lib/drama/projects.ts";
import { listDramaProjectVersions } from "../apps/api/src/lib/drama/project-versions.ts";
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
  ).run(id, `dup-${id.slice(0, 8)}@test.local`);
  return id;
}

function createSession(userId: string): string {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO image_sessions (id, user_id, title, mode, status)
     VALUES (?, ?, 'dup-test', 'chat', 'idle')`,
  ).run(id, userId);
  return id;
}

function buildProject(title: string): DramaProjectData {
  return {
    projectType: "short_drama",
    userIdea: "副本测试想法",
    targetDurationSec: 60,
    script: { title, logline: "原始梗概", acts: [], narratorLines: [] },
    styleBible: {
      palette: ["cool"],
      lightingStyle: "hard",
      aspectRatio: "9:16",
      negativePrompt: "",
    },
    characters: [
      {
        id: "char_1",
        name: "主角",
        role: "protagonist",
        visualSignature: {
          age: "青年",
          gender: "男",
          build: "中等",
          hair: "黑短",
          outfit: "外卖服",
          distinctive: "疤",
        },
        promptAnchor: "外卖小哥",
      },
    ] as DramaProjectData["characters"],
    scenes: [
      { id: "scene_1", name: "街道", location: "城市", atmosphere: "夜", promptAnchor: "霓虹" },
    ] as DramaProjectData["scenes"],
    shots: [],
    productionParams: { previewTier: "low", aspectRatio: "9:16" },
  };
}

console.log("\n=== 项目深拷贝 duplicate ===\n");

const userId = createVerifiedUser();
const sessionId = createSession(userId);

const source = createDramaProject({ sessionId, userId, project: buildProject("重生逆袭记") });

// 1. 第一次拷贝 → 「（副本）」
const copy1 = duplicateDramaProject(userId, source.id);
const copy1Project = parseProjectJson(copy1);
ok("1. 副本为新项目 id", copy1.id !== source.id);
ok("2. 副本同 session", copy1.session_id === source.session_id);
ok("3. 标题追加（副本）", copy1Project.script.title === "重生逆袭记（副本）", copy1Project.script.title);
ok("4. 深拷贝角色/场景保留", copy1Project.characters.length === 1 && copy1Project.scenes.length === 1);

// 2. 第二次拷贝 → 「（副本2）」去重
const copy2 = duplicateDramaProject(userId, source.id);
ok(
  "5. 第二个副本标题去重为（副本2）",
  parseProjectJson(copy2).script.title === "重生逆袭记（副本2）",
  parseProjectJson(copy2).script.title,
);

// 3. 副本有独立的 initial 版本历史
const copyVersions = listDramaProjectVersions(userId, copy1.id);
ok("6. 副本有独立 initial 版本", copyVersions.length === 1 && copyVersions[0].trigger === "initial");

// 4. 修改副本不影响源项目
updateDramaProject(
  copy1.id,
  { project: { ...copy1Project, script: { ...copy1Project.script, title: "被改的副本" } } },
  { userId },
);
const sourceAfter = parseProjectJson(getDramaProject(userId, source.id)!);
ok("7. 改副本不影响源项目标题", sourceAfter.script.title === "重生逆袭记");

// 5. 拷贝不存在项目 → 404
let notFound = false;
try {
  duplicateDramaProject(userId, randomUUID());
} catch (err) {
  notFound = (err as { status?: number }).status === 404;
}
ok("8. 拷贝不存在项目返回 404", notFound);

// 6. 他人无法拷贝
const other = createVerifiedUser();
let otherNotFound = false;
try {
  duplicateDramaProject(other, source.id);
} catch (err) {
  otherNotFound = (err as { status?: number }).status === 404;
}
ok("9. 他人拷贝返回 404", otherNotFound);

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
