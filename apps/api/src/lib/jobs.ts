import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";
import { estimatePoints } from "./pricing.js";
import { AppError } from "./errors.js";

const delayMs = Number(process.env.MOCK_GENERATION_DELAY_MS ?? 2500);

function placeholderUrl(prompt: string, index: number) {
  const seed = encodeURIComponent(prompt.slice(0, 40) || "aimarket");
  return `https://picsum.photos/seed/${seed}-${index}/1024/1024`;
}

export function createGenerationJob(input: {
  sessionId: string;
  userId: string;
  prompt: string;
  modelId: string;
  mode: string;
  count: number;
  resolution: string;
}) {
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
       (id, session_id, user_id, model_id, prompt, mode, count, resolution, status, points_cost)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?)`,
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
    );

    db.prepare(
      `INSERT INTO messages (id, session_id, role, content, job_id)
       VALUES (?, ?, 'user', ?, ?)`,
    ).run(userMessageId, input.sessionId, input.prompt, jobId);

    db.prepare(
      "UPDATE image_sessions SET status = 'running', updated_at = datetime('now') WHERE id = ?",
    ).run(input.sessionId);
  });

  queueMicrotask(() => runJob(jobId));

  return { jobId, pointsCost, userMessageId };
}

async function runJob(jobId: string) {
  const job = db
    .prepare(
      `SELECT id, session_id, user_id, prompt, count, points_cost, status
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
      }
    | undefined;

  if (!job || job.status !== "queued") return;

  db.prepare("UPDATE generation_jobs SET status = 'running' WHERE id = ?").run(
    jobId,
  );

  await new Promise((r) => setTimeout(r, delayMs));

  try {
    const outputs: string[] = [];
    for (let i = 0; i < job.count; i++) {
      outputs.push(placeholderUrl(job.prompt, i));
    }

    const assistantMessageId = randomUUID();

    db.transaction(() => {
      for (let i = 0; i < outputs.length; i++) {
        db.prepare(
          `INSERT INTO job_outputs (id, job_id, url, sort_order) VALUES (?, ?, ?, ?)`,
        ).run(randomUUID(), jobId, outputs[i], i);
      }

      db.prepare(
        `INSERT INTO messages (id, session_id, role, content, job_id)
         VALUES (?, ?, 'assistant', ?, ?)`,
      ).run(
        assistantMessageId,
        job.session_id,
        `已根据你的描述生成 ${outputs.length} 张图片。`,
        jobId,
      );

      for (let i = 0; i < outputs.length; i++) {
        db.prepare(
          `INSERT INTO message_outputs (id, message_id, url, sort_order) VALUES (?, ?, ?, ?)`,
        ).run(randomUUID(), assistantMessageId, outputs[i], i);
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
              status, points_cost, error, created_at, completed_at
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
