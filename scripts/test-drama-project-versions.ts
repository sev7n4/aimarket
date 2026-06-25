/**
 * PROD-C07 — 版本对比与回滚
 * pnpm --filter @aimarket/api exec tsx ../../scripts/test-drama-project-versions.ts
 */
import { randomUUID } from "node:crypto";
import { db } from "../apps/api/src/db/index.js";
import { createDramaProject, getDramaProject, parseProjectJson, updateDramaProject } from "../apps/api/src/lib/drama/projects.ts";
import {
  diffDramaProjectVersions,
  getDramaProjectVersion,
  listDramaProjectVersions,
  restoreDramaProjectVersion,
  snapshotDramaProjectVersion,
} from "../apps/api/src/lib/drama/project-versions.ts";
import type { DramaProjectData } from "../apps/api/src/lib/drama/schema.ts";

const results: { name: string; pass: boolean; detail?: string }[] = [];

function ok(name: string, pass: boolean, detail?: string) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

function createVerifiedUser(): string {
  const id = randomUUID();
  const email = `ver-${id.slice(0, 8)}@test.local`;
  db.prepare(
    `INSERT INTO users (id, email, password_hash, credits, email_verified_at)
     VALUES (?, ?, 'hash', 10000, datetime('now'))`,
  ).run(id, email);
  return id;
}

function createSession(userId: string): string {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO image_sessions (id, user_id, title, mode, status)
     VALUES (?, ?, 'ver-test', 'chat', 'idle')`,
  ).run(id, userId);
  return id;
}

function buildProject(title: string): DramaProjectData {
  return {
    projectType: "short_drama",
    userIdea: "版本回滚测试",
    targetDurationSec: 60,
    script: {
      title,
      logline: "版本快照",
      acts: [],
      narratorLines: [],
    },
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

console.log("\n=== PROD-C07 版本对比与回滚 ===\n");

const userId = createVerifiedUser();
const sessionId = createSession(userId);

// 1. 创建项目（应自动写入 initial 版本）
const projectRow = createDramaProject({
  sessionId,
  userId,
  project: buildProject("v1 初始"),
});

let versions = listDramaProjectVersions(userId, projectRow.id);
ok("1. 创建项目自动写入 initial 版本", versions.length === 1 && versions[0].trigger === "initial");
ok("2. initial 版本 isCurrent=true", versions[0].isCurrent === true);
ok("3. initial 版本 note='初始版本'", versions[0].note === "初始版本");

// 2. PATCH 一次（title 改为 v2）
const initialVersionId = versions[0].id;
let updated = buildProject("v2 第一次编辑");
updateDramaProject(projectRow.id, { project: updated }, { userId, snapshotTrigger: "manual_patch" });
versions = listDramaProjectVersions(userId, projectRow.id);
ok("4. PATCH 后版本数=2", versions.length === 2);
ok("5. 新版本 trigger=manual_patch", versions[0].trigger === "manual_patch");
ok("6. 新版本 isCurrent=true", versions[0].isCurrent === true);
ok("7. 旧版本 isCurrent=false", versions[1].isCurrent === false);
ok("8. 新版本 parent 指向 initial", versions[0].parentVersionId === initialVersionId);

const v2VersionId = versions[0].id;

// 3. PATCH 第二次（title 改为 v3）
updateDramaProject(
  projectRow.id,
  { project: buildProject("v3 第二次编辑") },
  { userId, snapshotTrigger: "auto_save", snapshotNote: "timeline 编辑" },
);
versions = listDramaProjectVersions(userId, projectRow.id);
ok("9. 第二次 PATCH 后版本数=3", versions.length === 3);
ok("10. 新版本 trigger=auto_save", versions[0].trigger === "auto_save");
ok("11. 新版本 note='timeline 编辑'", versions[0].note === "timeline 编辑");
ok("12. 新版本 parent 指向 v2", versions[0].parentVersionId === v2VersionId);

const v3VersionId = versions[0].id;

// 4. 验证 detail 接口能取到 v2 的快照（title='v2 第一次编辑'）
const v2Detail = getDramaProjectVersion(userId, projectRow.id, v2VersionId);
ok(
  "13. getDramaProjectVersion 返回 v2 的快照 title",
  v2Detail.project.project.script.title === "v2 第一次编辑",
  `实际=${v2Detail.project.project.script.title}`,
);

// 5. 验证当前 project_json 是 v3
const currentRow = getDramaProject(userId, projectRow.id)!;
const currentProject = parseProjectJson(currentRow);
ok(
  "14. 当前 project_json title='v3 第二次编辑'",
  currentProject.script.title === "v3 第二次编辑",
);

// 6. 回滚到 v2
const restoreResult = restoreDramaProjectVersion(
  userId,
  projectRow.id,
  v2VersionId,
  "回滚到 v2 测试",
);
ok("15. restore 返回 trigger=restore", restoreResult.trigger === "restore");
ok("16. restore 返回 parent 指向 v2", restoreResult.parentVersionId === v2VersionId);
ok(
  "17. restore 后 project_json title='v2 第一次编辑'",
  restoreResult.project.project.script.title === "v2 第一次编辑",
);

// 7. 验证 drama_projects 也被覆盖为 v2
const afterRestoreRow = getDramaProject(userId, projectRow.id)!;
const afterRestoreProject = parseProjectJson(afterRestoreRow);
ok(
  "18. drama_projects 表 title 也被覆盖为 v2",
  afterRestoreProject.script.title === "v2 第一次编辑",
);

// 8. 验证版本列表：应有 4 条（initial + manual_patch + auto_save + restore）
versions = listDramaProjectVersions(userId, projectRow.id);
ok(
  "19. 回滚后版本数=4",
  versions.length === 4,
  `实际=${versions.length}`,
);
ok("20. 最新版本 isCurrent=true", versions[0].isCurrent === true);
ok("21. 最新版本 trigger=restore", versions[0].trigger === "restore");
ok("22. 最新版本 parent 指向 v2", versions[0].parentVersionId === v2VersionId);

const restoreVersionId = versions[0].id;

// 9. 验证 diff 接口（v2 vs restore 后版本 — 因为内容相同，changedPaths 应该为空）
const diffSame = diffDramaProjectVersions(
  userId,
  projectRow.id,
  v2VersionId,
  restoreVersionId,
);
ok(
  "23. v2 vs restore 后版本内容相同 → changedPaths=0",
  diffSame.changedPaths.length === 0,
  `实际=${diffSame.changedPaths.length}`,
);

// 10. 验证 diff 接口（v3 vs restore 后版本 — 内容不同，应该有变更）
const diffDiff = diffDramaProjectVersions(
  userId,
  projectRow.id,
  v3VersionId,
  restoreVersionId,
);
ok(
  "24. v3 vs restore 后版本存在差异",
  diffDiff.changedPaths.length > 0 && diffDiff.stats.modified > 0,
  `modified=${diffDiff.stats.modified}`,
);

// 11. 验证 isCurrent 标记：只有 restoreVersionId 是 current
const currentCount = versions.filter((v) => v.isCurrent).length;
ok("25. 仅一个版本 isCurrent=true", currentCount === 1);

// 12. restore 到不存在版本应抛 404
let error404 = false;
try {
  restoreDramaProjectVersion(userId, projectRow.id, "nonexistent-uuid");
} catch (err) {
  error404 = (err as { status?: number }).status === 404;
}
ok("26. restore 不存在版本返回 404", error404);

// 13. 获取不存在版本 detail 应抛 404
let detail404 = false;
try {
  getDramaProjectVersion(userId, projectRow.id, "nonexistent-uuid");
} catch (err) {
  detail404 = (err as { status?: number }).status === 404;
}
ok("27. getDramaProjectVersion 不存在返回 404", detail404);

// 14. 其他用户无法看到本项目版本
const otherUserId = createVerifiedUser();
let otherError = false;
try {
  listDramaProjectVersions(otherUserId, projectRow.id);
} catch (err) {
  otherError = (err as { status?: number }).status === 404;
}
ok("28. 其他用户 list 返回 404（项目不存在）", otherError);

// 15. 手动 snapshot 也能用
const manualSnapId = snapshotDramaProjectVersion({
  projectId: projectRow.id,
  userId,
  projectJson: JSON.stringify(buildProject("manual snapshot")),
  trigger: "auto_save",
  note: "手动快照测试",
});
versions = listDramaProjectVersions(userId, projectRow.id);
ok(
  "29. 手动 snapshot 后版本数=5",
  versions.length === 5 && versions[0].id === manualSnapId,
);

// 16. 删除项目后版本应级联删除
db.prepare(`DELETE FROM drama_projects WHERE id = ?`).run(projectRow.id);
const afterDelete = db
  .prepare(`SELECT COUNT(*) as c FROM drama_project_versions WHERE project_id = ?`)
  .get(projectRow.id) as { c: number };
ok("30. 删除 project 后版本级联删除", afterDelete.c === 0, `剩余=${afterDelete.c}`);

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
