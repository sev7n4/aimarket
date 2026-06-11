/**
 * video-provider-errors 单测
 * pnpm --filter @aimarket/api exec tsx ../../scripts/test-video-provider-errors.ts
 */
import {
  formatAgnesVideoTimeoutMessage,
  parseWanVideoErrorBody,
  WAN_ARREARAGE_MESSAGE,
} from "../apps/api/src/lib/video-provider-errors.js";
import { formatJobErrorMessage } from "../apps/web/src/lib/job-error-message.ts";

const results: { name: string; pass: boolean }[] = [];

function ok(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

ok(
  "wan arrearage json",
  parseWanVideoErrorBody(
    '{"code":"Arrearage","message":"The account is in arrears."}',
  ) === WAN_ARREARAGE_MESSAGE,
);

ok(
  "agnes timeout message",
  formatAgnesVideoTimeoutMessage({
    taskId: "t1",
    lastStatus: "queued",
    lastProgress: 0,
    timeoutMs: 900_000,
    polls: 42,
  }).includes("排队超时"),
);

const wanUi = formatJobErrorMessage(WAN_ARREARAGE_MESSAGE, { toolType: "video" });
ok("job ui wan arrearage", wanUi != null && /欠费/.test(wanUi));

const agnesUi = formatJobErrorMessage(
  "Agnes Video 排队超时：任务 x 在 15 分钟内仍为 queued",
  { toolType: "video" },
);
ok(
  "job ui agnes queue timeout",
  agnesUi != null && /Agnes 队列繁忙/.test(agnesUi),
);

const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} 通过\n`);
process.exit(failed > 0 ? 1 : 0);
