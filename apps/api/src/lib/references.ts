import { db } from "../db/index.js";

export interface SessionReference {
  id: string;
  url: string;
  label: string;
  createdAt: string;
}

export function listSessionReferences(sessionId: string): SessionReference[] {
  const rows = db
    .prepare(
      `SELECT mo.id, mo.url, m.created_at
       FROM message_outputs mo
       JOIN messages m ON m.id = mo.message_id
       WHERE m.session_id = ? AND m.role = 'assistant'
       ORDER BY m.created_at DESC, mo.sort_order ASC
       LIMIT 30`,
    )
    .all(sessionId) as { id: string; url: string; created_at: string }[];

  return rows.map((row, index) => ({
    id: row.id,
    url: row.url,
    label: `生成图 ${rows.length - index}`,
    createdAt: row.created_at,
  }));
}

export function resolveReferenceUrls(outputIds: string[]): string[] {
  const urls: string[] = [];
  for (const id of outputIds) {
    const row = db
      .prepare("SELECT url FROM message_outputs WHERE id = ?")
      .get(id) as { url: string } | undefined;
    if (row) urls.push(row.url);
  }
  return urls;
}

export function enrichPromptWithReferences(
  prompt: string,
  referenceUrls: string[],
): string {
  if (!referenceUrls.length) return prompt;
  const refs = referenceUrls
    .map((url, i) => `[引用图${i + 1}: ${url}]`)
    .join("\n");
  return `${prompt}\n\n${refs}`;
}
