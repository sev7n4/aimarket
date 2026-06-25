import { randomUUID } from "node:crypto";
import { db } from "../../db/index.js";
import { AppError } from "../errors.js";
import {
  type DramaProjectRow,
  getDramaProject,
  parseProjectJson,
  serializeDramaProject,
  updateDramaProject,
} from "./projects.js";

export type DramaProjectVersionTrigger =
  | "manual_patch"
  | "auto_save"
  | "restore"
  | "initial";

export interface DramaProjectVersionRow {
  id: string;
  project_id: string;
  user_id: string;
  project_json: string;
  trigger: string;
  parent_version_id: string | null;
  note: string | null;
  created_at: string;
}

export interface DramaProjectVersionSummary {
  id: string;
  projectId: string;
  trigger: string;
  parentVersionId: string | null;
  note: string | null;
  createdAt: string;
  /** 是否为当前 project 的最新版本（与 drama_projects.updated_at 对齐） */
  isCurrent: boolean;
}

export interface DramaProjectVersionDetail extends DramaProjectVersionSummary {
  /** 序列化后的 project（含 characters refUrls 富化），可直接交给前端预览 */
  project: ReturnType<typeof serializeDramaProject>;
}

const VERSION_SELECT = `
  SELECT
    id,
    project_id,
    user_id,
    project_json,
    trigger,
    parent_version_id,
    note,
    created_at
  FROM drama_project_versions
`;

function rowToSummary(
  row: DramaProjectVersionRow,
  currentVersionId: string | null,
): DramaProjectVersionSummary {
  return {
    id: row.id,
    projectId: row.project_id,
    trigger: row.trigger,
    parentVersionId: row.parent_version_id,
    note: row.note,
    createdAt: row.created_at,
    isCurrent: currentVersionId === null ? false : row.id === currentVersionId,
  };
}

function rowToDetail(
  row: DramaProjectRow,
  versionRow: DramaProjectVersionRow,
  currentVersionId: string | null,
): DramaProjectVersionDetail {
  const versionedRow: DramaProjectRow = {
    ...row,
    project_json: versionRow.project_json,
    updated_at: versionRow.created_at,
  };
  return {
    ...rowToSummary(versionRow, currentVersionId),
    project: serializeDramaProject(versionedRow),
  };
}

/**
 * 列出某 project 的所有版本（按插入顺序倒序，避免同一秒插入时排序不稳定）。
 * 同时计算「当前版本」= 最近一条版本记录。
 */
export function listDramaProjectVersions(
  userId: string,
  projectId: string,
): DramaProjectVersionSummary[] {
  const row = getDramaProject(userId, projectId);
  if (!row) {
    throw new AppError(404, "NOT_FOUND", "短剧项目不存在");
  }
  const rows = db
    .prepare(
      `${VERSION_SELECT}
       WHERE project_id = ? AND user_id = ?
       ORDER BY rowid DESC`,
    )
    .all(projectId, userId) as unknown as DramaProjectVersionRow[];
  const currentVersionId = rows.length > 0 ? rows[0].id : null;
  return rows.map((r) => rowToSummary(r, currentVersionId));
}

/** 获取单个版本的完整快照（含序列化 project）。 */
export function getDramaProjectVersion(
  userId: string,
  projectId: string,
  versionId: string,
): DramaProjectVersionDetail {
  const row = getDramaProject(userId, projectId);
  if (!row) {
    throw new AppError(404, "NOT_FOUND", "短剧项目不存在");
  }
  const versionRow = db
    .prepare(
      `${VERSION_SELECT}
       WHERE id = ? AND project_id = ? AND user_id = ?`,
    )
    .get(versionId, projectId, userId) as unknown as
    | DramaProjectVersionRow
    | undefined;
  if (!versionRow) {
    throw new AppError(404, "NOT_FOUND", "版本不存在");
  }
  // 当前版本 = 最新一条版本记录
  const latest = db
    .prepare(
      `SELECT id FROM drama_project_versions
       WHERE project_id = ? AND user_id = ?
       ORDER BY rowid DESC LIMIT 1`,
    )
    .get(projectId, userId) as unknown as { id: string } | undefined;
  const currentVersionId = latest ? latest.id : versionRow.id;
  return rowToDetail(row, versionRow, currentVersionId);
}

/**
 * 在更新前写入一条快照（内部使用）。
 * @param trigger 来源：manual_patch / auto_save / restore / initial
 * @param parentVersionId 父版本 ID（restore 时为目标版本，其余为上一条最新版本）
 * @param note 可选备注
 */
export function snapshotDramaProjectVersion(input: {
  projectId: string;
  userId: string;
  projectJson: string;
  trigger: DramaProjectVersionTrigger;
  parentVersionId?: string | null;
  note?: string | null;
}): string {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO drama_project_versions
       (id, project_id, user_id, project_json, trigger, parent_version_id, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
  ).run(
    id,
    input.projectId,
    input.userId,
    input.projectJson,
    input.trigger,
    input.parentVersionId ?? null,
    input.note ?? null,
  );
  return id;
}

/**
 * 写入「初始版本」（在 createDramaProject 后调用）。
 */
export function snapshotInitialVersion(
  projectId: string,
  userId: string,
  projectJson: string,
): string {
  return snapshotDramaProjectVersion({
    projectId,
    userId,
    projectJson,
    trigger: "initial",
    parentVersionId: null,
    note: "初始版本",
  });
}

/** 取最新一条版本记录（用于建立 parent 关系，按 rowid 保证插入顺序）。 */
function getLatestVersionId(
  projectId: string,
  userId: string,
): string | null {
  const row = db
    .prepare(
      `SELECT id FROM drama_project_versions
       WHERE project_id = ? AND user_id = ?
       ORDER BY rowid DESC LIMIT 1`,
    )
    .get(projectId, userId) as unknown as { id: string } | undefined;
  return row ? row.id : null;
}

/**
 * 在 PATCH 之后保存「当前新状态」快照。
 * 应在 updateDramaProject 内部调用，确保每次更新都会产生版本记录。
 * 每个版本代表「该时刻 project 的状态」。
 */
export function snapshotAfterUpdate(input: {
  projectId: string;
  userId: string;
  currentProjectJson: string;
  trigger?: DramaProjectVersionTrigger;
  note?: string | null;
}): string {
  const parentVersionId = getLatestVersionId(input.projectId, input.userId);
  return snapshotDramaProjectVersion({
    projectId: input.projectId,
    userId: input.userId,
    projectJson: input.currentProjectJson,
    trigger: input.trigger ?? "manual_patch",
    parentVersionId,
    note: input.note ?? null,
  });
}

/**
 * 回滚到指定版本：
 * 1. 用目标版本的 project_json 覆盖 drama_projects
 * 2. 写入「restore」版本，parent_version_id 指向被回滚的目标版本
 *    该版本代表「回滚后的当前状态」
 *
 * @returns 新写入的 restore 版本详情
 */
export function restoreDramaProjectVersion(
  userId: string,
  projectId: string,
  versionId: string,
  note?: string,
): DramaProjectVersionDetail {
  const row = getDramaProject(userId, projectId);
  if (!row) {
    throw new AppError(404, "NOT_FOUND", "短剧项目不存在");
  }
  const target = db
    .prepare(
      `${VERSION_SELECT}
       WHERE id = ? AND project_id = ? AND user_id = ?`,
    )
    .get(versionId, projectId, userId) as unknown as
    | DramaProjectVersionRow
    | undefined;
  if (!target) {
    throw new AppError(404, "NOT_FOUND", "版本不存在");
  }

  // 1. 用目标版本的 project_json 覆盖 drama_projects（跳过 snapshot）
  updateDramaProject(
    projectId,
    {
      project: parseProjectJson({
        ...row,
        project_json: target.project_json,
      }),
    },
    { skipSnapshot: true },
  );

  // 2. 写入「restore」版本（代表回滚后的当前状态）
  const newId = snapshotDramaProjectVersion({
    projectId,
    userId,
    projectJson: target.project_json,
    trigger: "restore",
    parentVersionId: target.id,
    note: note ?? `回滚到版本 ${target.id.slice(0, 8)}`,
  });

  const newRow = getDramaProject(userId, projectId);
  if (!newRow) {
    throw new AppError(500, "INTERNAL_ERROR", "回滚后项目丢失");
  }
  const newVersionRow = db
    .prepare(
      `${VERSION_SELECT} WHERE id = ?`,
    )
    .get(newId) as unknown as DramaProjectVersionRow;
  return rowToDetail(newRow, newVersionRow, newId);
}

/**
 * 获取两版本之间的差异摘要（轻量级，仅返回字段路径列表 + 大致变更类型）。
 * 用于 UI 渲染「版本对比」时的快速概览。
 */
export interface DramaProjectVersionDiff {
  versionAId: string;
  versionBId: string;
  /** 变更字段路径（dot-path），如 "script.title"、"shots[0].description" */
  changedPaths: string[];
  /** 简要统计：新增/修改/删除的字段计数 */
  stats: {
    added: number;
    modified: number;
    removed: number;
  };
}

function collectPaths(obj: unknown, prefix: string, out: Map<string, unknown>) {
  if (obj === null || typeof obj !== "object") {
    out.set(prefix, obj);
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, idx) => {
      collectPaths(item, `${prefix}[${idx}]`, out);
    });
    return;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const next = prefix ? `${prefix}.${k}` : k;
    collectPaths(v, next, out);
  }
}

function diffObjects(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): { added: string[]; modified: string[]; removed: string[] } {
  const aPaths = new Map<string, unknown>();
  const bPaths = new Map<string, unknown>();
  collectPaths(a, "", aPaths);
  collectPaths(b, "", bPaths);
  const added: string[] = [];
  const modified: string[] = [];
  const removed: string[] = [];
  for (const [path, bVal] of bPaths) {
    if (!aPaths.has(path)) {
      added.push(path);
    } else {
      const aVal = aPaths.get(path);
      if (JSON.stringify(aVal) !== JSON.stringify(bVal)) {
        modified.push(path);
      }
    }
  }
  for (const path of aPaths.keys()) {
    if (!bPaths.has(path)) {
      removed.push(path);
    }
  }
  return { added, modified, removed };
}

export function diffDramaProjectVersions(
  userId: string,
  projectId: string,
  versionAId: string,
  versionBId: string,
): DramaProjectVersionDiff {
  const row = getDramaProject(userId, projectId);
  if (!row) {
    throw new AppError(404, "NOT_FOUND", "短剧项目不存在");
  }
  const aRow = db
    .prepare(`${VERSION_SELECT} WHERE id = ? AND project_id = ? AND user_id = ?`)
    .get(versionAId, projectId, userId) as unknown as
    | DramaProjectVersionRow
    | undefined;
  const bRow = db
    .prepare(`${VERSION_SELECT} WHERE id = ? AND project_id = ? AND user_id = ?`)
    .get(versionBId, projectId, userId) as unknown as
    | DramaProjectVersionRow
    | undefined;
  if (!aRow || !bRow) {
    throw new AppError(404, "NOT_FOUND", "版本不存在");
  }
  const a = JSON.parse(aRow.project_json) as Record<string, unknown>;
  const b = JSON.parse(bRow.project_json) as Record<string, unknown>;
  const { added, modified, removed } = diffObjects(a, b);
  return {
    versionAId,
    versionBId,
    changedPaths: [...added, ...modified, ...removed],
    stats: {
      added: added.length,
      modified: modified.length,
      removed: removed.length,
    },
  };
}
