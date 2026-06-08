/**
 * job-error-message 单测
 * pnpm --filter @aimarket/api exec tsx ../../scripts/test-job-error-message.ts
 */
import { formatJobErrorMessage } from "../apps/web/src/lib/job-error-message.ts";

const results: { name: string; pass: boolean }[] = [];

function ok(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

const seedream429 = formatJobErrorMessage(
  '火山方舟 Seedream 失败 (429): {"code":"SetLimitExceeded"}',
);
ok(
  "seedream 429 auto route",
  seedream429 != null && /配额已满/.test(seedream429) && /兜底/.test(seedream429),
);

const seedream429Tool = formatJobErrorMessage(
  '火山方舟 Seedream 失败 (429): {"code":"SetLimitExceeded"}',
  { toolType: "expand" },
);
ok(
  "expand 429 no fallback wording",
  seedream429Tool != null &&
    /扩图失败/.test(seedream429Tool) &&
    !/兜底/.test(seedream429Tool),
);

const missing = formatJobErrorMessage("ALIYUN_WAN_I2I_MODEL 未配置");
ok(
  "missing i2i model",
  missing != null && /万相图生图模型/.test(missing),
);

const agnes500 = formatJobErrorMessage(
  'Agnes Image 失败 (500): {"error":{"type":"upstream_error","code":"500"}}',
);
ok(
  "agnes 500 auto route",
  agnes500 != null && /Agnes 图像服务暂时不可用/.test(agnes500) && /兜底/.test(agnes500),
);

const authTool = formatJobErrorMessage("DashScope 鉴权失败 (401): InvalidApiKey", {
  toolType: "cutout",
});
ok(
  "tool auth error",
  authTool != null && /抠图失败/.test(authTool) && /鉴权失败/.test(authTool),
);

const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} 通过\n`);
process.exit(failed > 0 ? 1 : 0);
