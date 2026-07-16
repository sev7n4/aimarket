import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";
import {
  getPublishedInspirationById,
  renderInspirationWithVariables,
} from "./inspiration.js";
import { resolveWorkspaceIdForUser } from "./workspaces.js";
import { mapSessionForUser } from "./session-access.js";
import { estimatePoints } from "./pricing.js";

const SESSION_SELECT =
  "id, user_id, workspace_id, title, mode, kind, status, source_inspiration_id, template_variables_json, created_at, updated_at";

export function forkProjectFromInspiration(
  userId: string,
  inspirationId: string,
  opts?: {
    variables?: Record<string, string>;
    mode?: "chat" | "image" | "ecommerce";
    workspaceId?: string;
  },
) {
  const row = getPublishedInspirationById(inspirationId);
  const rendered = renderInspirationWithVariables(row, opts?.variables);
  const sessionId = randomUUID();
  const mode = opts?.mode ?? "chat";
  const workspaceId = resolveWorkspaceIdForUser(userId, opts?.workspaceId);
  const variablesJson =
    rendered.variables?.length ?
      JSON.stringify(
        Object.fromEntries(rendered.variables.map((v) => [v.key, v.default])),
      )
    : null;

  db.prepare(
    `INSERT INTO image_sessions
     (id, user_id, workspace_id, title, mode, kind, source_inspiration_id, template_variables_json)
     VALUES (?, ?, ?, ?, ?, 'project', ?, ?)`,
  ).run(
    sessionId,
    userId,
    workspaceId,
    rendered.title,
    mode,
    inspirationId,
    variablesJson,
  );

  const estimatedPoints = estimatePoints(
    rendered.modelId,
    1,
    rendered.resolution,
  );

  const session = db
    .prepare(`SELECT ${SESSION_SELECT} FROM image_sessions WHERE id = ?`)
    .get(sessionId) as Parameters<typeof mapSessionForUser>[0];

  return {
    session: mapSessionForUser(session!, userId),
    inspiration: {
      id: rendered.id,
      title: rendered.title,
      prompt: rendered.prompt,
      promptTemplate: rendered.promptTemplate,
      variables: rendered.variables,
      modelId: rendered.modelId,
      aspectRatio: rendered.aspectRatio,
      resolution: rendered.resolution,
      referenceAssets: rendered.referenceAssets,
    },
    estimatedPoints,
  };
}
