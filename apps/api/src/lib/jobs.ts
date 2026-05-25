import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";
import { ECOMMERCE_SLIDES } from "./ecommerce.js";
import { estimatePoints } from "./pricing.js";
import { AppError } from "./errors.js";

const delayMs = Number(process.env.MOCK_GENERATION_DELAY_MS ?? 2500);

function placeholderUrl(seed: string, index: number, width = 1024, height = 1024) {
  const s = encodeURIComponent(seed.slice(0, 48) || "aimarket");
  return `https://picsum.photos/seed/${s}-${index}/${width}/${height}`;
}

export interface CreateJobInput {
  sessionId: string;
  userId: string;
  prompt: string;
  modelId: string;
  mode: string;
  count: number;
  resolution: string;
  toolType?: string;
  slideLabels?: string[];
}

export function createGenerationJob(input: CreateJobInput) {
  const pointsCost = estimatePoints(
    input.modelId,
    input.count,
    input.resolution,
  );

  const user = db
    .prepare("SELECT credits FROM users WHERE id = ?")
    .get(input.userId) as { credits: number } | undefined;

  if (!user) {
    throw new AppError(404, "NOT_FOUND", "用户不存在");
  }
  if (user.credits < pointsCost) {
    throw new AppError(402, "INSUFFICIENT_CREDITS", "积分不足，请充值后再试");
  }

  const session = db
    .prepare("SELECT id, user_id FROM image_sessions WHERE id = ?")
    .get(input.sessionId) as { id: string; user_id: string } | undefined;

  if (!session || session.user_id !== input.userId) {
    throw new AppError(404, "NOT_FOUND", "会话不存在");
  }

  const jobId = randomUUID();
  const userMessageId = randomUUID();

  db.transaction(() => {
    db.prepare(
      "UPDATE users SET credits = credits - ? WHERE id = ? AND credits >= ?",
    ).run(pointsCost, input.userId, pointsCost);

    db.prepare(
      `INSERT INTO generation_jobs
       (id, session_id, user_id, model_id, prompt, mode, count, resolution, status, points_cost, tool_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?)`,
    ).run(
      jobId,
      input.sessionId,
      input.userId,
      input.modelId,
      input.prompt,
      input.mode,
      input.count,
      input.resolution,
      pointsCost,
      input.toolType ?? null,
    );

    db.prepare(
      `INSERT INTO messages (id, session_id, role, content, job_id)
       VALUES (?, ?, 'user', ?, ?)`,
    ).run(userMessageId, input.sessionId, input.prompt, jobId);

    db.prepare(
      "UPDATE image_sessions SET status = 'running', updated_at = datetime('now') WHERE id = ?",
    ).run(input.sessionId);

    if (input.mode === "ecommerce") {
      db.prepare("UPDATE image_sessions SET title = ? WHERE id = ?").run(
        "电商套图",
        input.sessionId,
      );
    }
  });

  queueMicrotask(() =>
    runJob(jobId, input.slideLabels),
  );

  return { jobId, pointsCost, userMessageId };
}

async function runJob(jobId: string, slideLabels?: string[]) {
  const job = db
    .prepare(
      `SELECT id, session_id, user_id, prompt, count, points_cost, status, mode, tool_type
       FROM generation_jobs WHERE id = ?`,
    )
    .get(jobId) as
    | {
        id: string;
        session_id: string;
        user_id: string;
        prompt: string;
        count: number;
        points_cost: number;
        status: string;
        mode: string;
        tool_type: string | null;
      }
    | undefined;

  if (!job || job.status !== "queued") return;

  db.prepare("UPDATE generation_jobs SET status = 'running' WHERE id = ?").run(
    jobId,
  );

  await new Promise((r) => setTimeout(r, delayMs));

  try {
    const labels =
      slideLabels ??
      (job.mode === "ecommerce"
        ? ECOMMERCE_SLIDES.map((s) => s.label)
        : undefined);

    const outputs: { url: string; label?: string }[] = [];
    for (let i = 0; i < job.count; i++) {
      const seed = labels?.[i] ?? job.prompt;
      const label = labels?.[i];
      outputs.push({
        url: placeholderUrl(`${seed}-${job.tool_type ?? "gen"}`, i),
        label,
      });
    }

    const assistantMessageId = randomUUID();
    const summary =
      job.mode === "ecommerce"
        ? `电商套图方案已生成，共 ${outputs.length} 张：${labels?.join("、") ?? ""}`
        : job.tool_type
          ? `「${job.tool_type}」处理完成，共 ${outputs.length} 张。`
          : `已根据你的描述生成 ${outputs.length} 张图片。`;

    db.transaction(() => {
      for (let i = 0; i < outputs.length; i++) {
        db.prepare(
          `INSERT INTO job_outputs (id, job_id, url, sort_order) VALUES (?, ?, ?, ?)`,
        ).run(randomUUID(), jobId, outputs[i].url, i);
      }

      db.prepare(
        `INSERT INTO messages (id, session_id, role, content, job_id)
         VALUES (?, ?, 'assistant', ?, ?)`,
      ).run(assistantMessageId, job.session_id, summary, jobId);

      for (let i = 0; i < outputs.length; i++) {
        db.prepare(
          `INSERT INTO message_outputs (id, message_id, url, sort_order) VALUES (?, ?, ?, ?)`,
        ).run(randomUUID(), assistantMessageId, outputs[i].url, i);
      }

      db.prepare(
        `UPDATE generation_jobs SET status = 'succeeded', completed_at = datetime('now') WHERE id = ?`,
      ).run(jobId);

      db.prepare(
        `UPDATE image_sessions SET status = 'idle', updated_at = datetime('now') WHERE id = ?`,
      ).run(job.session_id);
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "生成失败";
    db.transaction(() => {
      db.prepare(
        `UPDATE generation_jobs SET status = 'failed', error = ?, completed_at = datetime('now') WHERE id = ?`,
      ).run(message, jobId);
      db.prepare(
        "UPDATE users SET credits = credits + ? WHERE id = ?",
      ).run(job.points_cost, job.user_id);
      db.prepare(
        `UPDATE image_sessions SET status = 'idle', updated_at = datetime('now') WHERE id = ?`,
      ).run(job.session_id);
      db.prepare(
        `INSERT INTO messages (id, session_id, role, content, job_id)
         VALUES (?, ?, 'assistant', ?, ?)`,
      ).run(
        randomUUID(),
        job.session_id,
        `生成失败：${message}，积分已退回。`,
        jobId,
      );
    });
  }
}

export function getJob(jobId: string, userId: string) {
  const job = db
    .prepare(
      `SELECT id, session_id, user_id, model_id, prompt, mode, count, resolution,
              status, points_cost, error, tool_type, created_at, completed_at
       FROM generation_jobs WHERE id = ?`,
    )
    .get(jobId) as Record<string, unknown> | undefined;

  if (!job || job.user_id !== userId) {
    throw new AppError(404, "NOT_FOUND", "任务不存在");
  }

  const outputs = db
    .prepare(
      `SELECT url, sort_order FROM job_outputs WHERE job_id = ? ORDER BY sort_order ASC`,
    )
    .all(jobId) as { url: string; sort_order: number }[];

  return { ...job, outputs };
}
