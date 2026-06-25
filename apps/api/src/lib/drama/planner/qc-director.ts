import { completeWithFallback, isAgentLlmEnabled } from "@aimarket/agent-core";
import { AppError } from "../../errors.js";
import type { DramaProjectData, StoryboardShot } from "../schema.js";
import { getDramaProject, parseProjectJson } from "../projects.js";
import {
  dramaQcReportSchema,
  parseQcReportJson,
  type DramaQcReport,
  type DramaQcShotScore,
} from "../qc-report.js";
import { getDramaRun, updateDramaRun } from "../runs.js";

const QC_JSON_SCHEMA = {
  type: "object",
  properties: {
    narrativeScore: { type: "number" },
    compositionScore: { type: "number" },
    summary: { type: "string" },
    shotNotes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          shotId: { type: "string" },
          narrativeScore: { type: "number" },
          compositionScore: { type: "number" },
          note: { type: "string" },
        },
        required: ["shotId", "narrativeScore", "compositionScore"],
      },
    },
  },
  required: ["narrativeScore", "compositionScore", "summary", "shotNotes"],
} as const;

function clampScore(v: number | undefined, fallback: number): number {
  if (typeof v !== "number" || Number.isNaN(v)) return fallback;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function shotConsistencyScore(shot: StoryboardShot): number {
  const audit = shot.auditScore;
  if (!audit) return 72;
  return Math.round(((audit.character ?? 72) + (audit.style ?? 72)) / 2);
}

function average(nums: number[]): number {
  if (!nums.length) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function buildRuleBasedShotScores(
  project: DramaProjectData,
  llmNotes?: Map<
    string,
    { narrativeScore: number; compositionScore: number; note?: string }
  >,
): DramaQcShotScore[] {
  return project.shots.map((shot) => {
    const consistencyScore = shotConsistencyScore(shot);
    const llm = llmNotes?.get(shot.id);
    const compositionScore = clampScore(llm?.compositionScore, consistencyScore);
    const narrativeScore = clampScore(llm?.narrativeScore, 75);
    const overallScore = Math.round(
      compositionScore * 0.3 + consistencyScore * 0.4 + narrativeScore * 0.3,
    );
    return {
      shotId: shot.id,
      order: shot.order,
      compositionScore,
      consistencyScore,
      narrativeScore,
      overallScore,
      note: llm?.note,
    };
  });
}

async function llmQcNotes(project: DramaProjectData): Promise<{
  narrativeScore: number;
  compositionScore: number;
  summary: string;
  shotNotes: Map<
    string,
    { narrativeScore: number; compositionScore: number; note?: string }
  >;
} | null> {
  if (!isAgentLlmEnabled()) return null;

  const payload = {
    title: project.script.title,
    logline: project.script.logline,
    userIdea: project.userIdea,
    shots: project.shots.map((s) => ({
      shotId: s.id,
      order: s.order,
      visualPrompt: s.visualPrompt,
      dialogue: s.dialogue,
      durationSec: s.durationSec,
    })),
  };

  try {
    const result = await completeWithFallback({
      messages: [
        {
          role: "system",
          content:
            "你是短剧导演质检专家。根据剧本与分镜评估叙事连贯性、构图表现力。" +
            "输出严格 JSON：narrativeScore/compositionScore(0-100)、summary(中文)、" +
            "shotNotes 数组含 shotId/narrativeScore/compositionScore/note。",
        },
        { role: "user", content: JSON.stringify(payload) },
      ],
      jsonSchema: QC_JSON_SCHEMA,
      temperature: 0.2,
      maxTokens: 4096,
    });

    const parsed = JSON.parse(result.content) as {
      narrativeScore?: number;
      compositionScore?: number;
      summary?: string;
      shotNotes?: Array<{
        shotId: string;
        narrativeScore?: number;
        compositionScore?: number;
        note?: string;
      }>;
    };

    const shotNotes = new Map<
      string,
      { narrativeScore: number; compositionScore: number; note?: string }
    >();
    for (const note of parsed.shotNotes ?? []) {
      if (!note.shotId) continue;
      shotNotes.set(note.shotId, {
        narrativeScore: clampScore(note.narrativeScore, 75),
        compositionScore: clampScore(note.compositionScore, 75),
        note: note.note,
      });
    }

    return {
      narrativeScore: clampScore(parsed.narrativeScore, 75),
      compositionScore: clampScore(parsed.compositionScore, 75),
      summary: parsed.summary?.trim() || "LLM 质检完成",
      shotNotes,
    };
  } catch (err) {
    console.warn("[drama-qc] LLM failed, rule fallback:", err);
    return null;
  }
}

export function buildDramaQcReport(
  project: DramaProjectData,
  llm?: Awaited<ReturnType<typeof llmQcNotes>>,
): DramaQcReport {
  const shots = buildRuleBasedShotScores(project, llm?.shotNotes);
  const consistencyScore = average(shots.map((s) => s.consistencyScore));
  const compositionScore = llm
    ? llm.compositionScore
    : average(shots.map((s) => s.compositionScore));
  const narrativeScore = llm
    ? llm.narrativeScore
    : average(shots.map((s) => s.narrativeScore));
  const overallScore = Math.round(
    compositionScore * 0.25 + consistencyScore * 0.45 + narrativeScore * 0.3,
  );

  return dramaQcReportSchema.parse({
    status: "completed",
    overallScore,
    compositionScore,
    consistencyScore,
    narrativeScore,
    shots,
    summary:
      llm?.summary ?? `规则质检：${shots.length} 镜，一致性均值 ${consistencyScore}`,
    provider: llm ? "llm+audit" : "rule+audit",
    completedAt: new Date().toISOString(),
  });
}

export async function runDramaRunQc(
  userId: string,
  runId: string,
): Promise<DramaQcReport> {
  const row = getDramaRun(userId, runId);
  if (!row) {
    throw new AppError(404, "NOT_FOUND", "短剧 Run 不存在");
  }
  if (row.status !== "completed") {
    throw new AppError(400, "INVALID_STATE", "仅已完成的 Run 可质检");
  }

  const projectRow = getDramaProject(userId, row.project_id);
  if (!projectRow) {
    throw new AppError(404, "NOT_FOUND", "短剧项目不存在");
  }

  updateDramaRun(runId, {
    qcReport: {
      status: "running",
      overallScore: 0,
      compositionScore: 0,
      consistencyScore: 0,
      narrativeScore: 0,
      shots: [],
      summary: "质检进行中",
      provider: "pending",
    },
  });

  try {
    const project = parseProjectJson(projectRow);
    const llm = await llmQcNotes(project);
    const report = buildDramaQcReport(project, llm ?? undefined);
    updateDramaRun(runId, { qcReport: report });
    return report;
  } catch (err) {
    const message = err instanceof Error ? err.message : "质检失败";
    updateDramaRun(runId, {
      qcReport: {
        status: "failed",
        overallScore: 0,
        compositionScore: 0,
        consistencyScore: 0,
        narrativeScore: 0,
        shots: [],
        summary: message,
        provider: "error",
        error: message,
        completedAt: new Date().toISOString(),
      },
    });
    throw err instanceof AppError
      ? err
      : new AppError(500, "QC_FAILED", message);
  }
}

export function getDramaRunQc(userId: string, runId: string): DramaQcReport {
  const row = getDramaRun(userId, runId);
  if (!row) {
    throw new AppError(404, "NOT_FOUND", "短剧 Run 不存在");
  }
  const report = parseQcReportJson(row.qc_report_json);
  if (!report) {
    throw new AppError(404, "NOT_FOUND", "尚未生成质检报告");
  }
  return report;
}

export function dispatchDramaRunQc(runId: string, userId: string) {
  void (async () => {
    try {
      const report = await runDramaRunQc(userId, runId);
      const { applyAutoQcRetry } = await import("../qc-auto-retry.js");
      await applyAutoQcRetry(userId, runId, report);
    } catch (err) {
      console.error("[drama-qc] auto qc failed:", err);
    }
  })();
}
