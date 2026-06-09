#!/usr/bin/env node
/**
 * job-watchdog 单测（纯逻辑）
 * pnpm --filter @aimarket/api exec tsx ../../scripts/test-job-watchdog.ts
 */
import {
  isStaleGenerationJob,
  jobMaxRunningMs,
  parseJobTimestampMs,
} from "../apps/api/src/lib/job-watchdog.ts";

const results: { name: string; pass: boolean; detail?: string }[] = [];

function ok(name: string, pass: boolean, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const base = "2026-06-09 12:00:00";
const baseMs = parseJobTimestampMs(base);

ok("parseJobTimestampMs", !Number.isNaN(baseMs));

const videoLimit = jobMaxRunningMs({
  toolType: "video",
  modelId: "seedance-2",
});
ok(
  "video max running >= 15min+buffer",
  videoLimit >= 900_000,
  String(videoLimit),
);

ok(
  "fresh video job not stale",
  !isStaleGenerationJob(
    {
      status: "running",
      created_at: base,
      tool_type: "video",
      model_id: "seedance-2",
    },
    baseMs + 5 * 60_000,
  ),
);

ok(
  "stale video job after limit",
  isStaleGenerationJob(
    {
      status: "running",
      created_at: base,
      tool_type: "video",
      model_id: "seedance-2",
    },
    baseMs + videoLimit + 1_000,
  ),
);

ok(
  "succeeded job never stale",
  !isStaleGenerationJob(
    {
      status: "succeeded",
      created_at: base,
      tool_type: "video",
      model_id: "seedance-2",
    },
    baseMs + videoLimit + 1_000,
  ),
);

const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} 通过\n`);
process.exit(failed > 0 ? 1 : 0);
