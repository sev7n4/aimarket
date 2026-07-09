import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "../db/index.js";
import { AppError } from "./errors.js";

export const workflowTemplateNodeSchema = z.object({
  type: z.string().min(1),
  title: z.string().min(1).max(120),
  relX: z.number(),
  relY: z.number(),
  width: z.number().min(40).max(2000),
  height: z.number().min(40).max(2000),
  metadata: z.record(z.unknown()).optional(),
});

export const workflowTemplatePayloadSchema = z.object({
  kind: z.literal("workflow").default("workflow"),
  nodes: z.array(workflowTemplateNodeSchema).min(1),
  connections: z
    .array(
      z.object({
        fromNodeIndex: z.number().int().min(0),
        toNodeIndex: z.number().int().min(0),
      }),
    )
    .default([]),
});

export type WorkflowTemplatePayload = z.infer<typeof workflowTemplatePayloadSchema>;

type WorkflowTemplateRow = {
  id: string;
  user_id: string | null;
  name: string;
  description: string | null;
  template_json: string;
  is_preset: number;
  created_at: string;
  updated_at: string;
};

function serializeRow(row: WorkflowTemplateRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    template: JSON.parse(row.template_json) as WorkflowTemplatePayload,
    isPreset: row.is_preset === 1,
    userId: row.user_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listWorkflowTemplates(userId: string) {
  const rows = db
    .prepare(
      `SELECT * FROM workflow_templates
       WHERE is_preset = 1 OR user_id = ?
       ORDER BY is_preset DESC, created_at DESC`,
    )
    .all(userId) as WorkflowTemplateRow[];
  return rows.map(serializeRow);
}

export function getWorkflowTemplate(userId: string, id: string) {
  const row = db
    .prepare(`SELECT * FROM workflow_templates WHERE id = ?`)
    .get(id) as WorkflowTemplateRow | undefined;
  if (!row) throw new AppError(404, "NOT_FOUND", "模板不存在");
  if (row.is_preset !== 1 && row.user_id !== userId) {
    throw new AppError(404, "NOT_FOUND", "模板不存在");
  }
  return serializeRow(row);
}

export function createWorkflowTemplate(
  userId: string,
  input: { name: string; description?: string; template: WorkflowTemplatePayload },
) {
  const payload = workflowTemplatePayloadSchema.parse(input.template);
  const id = randomUUID();
  db.prepare(
    `INSERT INTO workflow_templates
     (id, user_id, name, description, template_json, is_preset, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))`,
  ).run(id, userId, input.name, input.description ?? null, JSON.stringify(payload));
  return getWorkflowTemplate(userId, id);
}

export function deleteWorkflowTemplate(userId: string, id: string) {
  const row = db
    .prepare(`SELECT * FROM workflow_templates WHERE id = ?`)
    .get(id) as WorkflowTemplateRow | undefined;
  if (!row || row.is_preset === 1 || row.user_id !== userId) {
    throw new AppError(404, "NOT_FOUND", "模板不存在");
  }
  db.prepare(`DELETE FROM workflow_templates WHERE id = ?`).run(id);
  return { deleted: true, id };
}
