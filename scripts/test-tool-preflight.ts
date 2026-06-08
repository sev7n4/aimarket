/**
 * 工具 Provider 配置级 preflight 单测
 * pnpm --filter @aimarket/api exec tsx ../../scripts/test-tool-preflight.ts
 */
import { assertToolProviderReady } from "../apps/api/src/lib/tool-preflight.ts";

const results: { name: string; pass: boolean }[] = [];

function ok(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

const prevGlobal = process.env.TOOL_IMAGE_PROVIDER;
const prevArk = process.env.ARK_API_KEY;
const prevDash = process.env.DASHSCOPE_API_KEY;
const prevExpand = process.env.TOOL_EXPAND_PROVIDER;
const prevCutout = process.env.TOOL_CUTOUT_PROVIDER;

function restoreEnv() {
  if (prevGlobal === undefined) delete process.env.TOOL_IMAGE_PROVIDER;
  else process.env.TOOL_IMAGE_PROVIDER = prevGlobal;
  if (prevArk === undefined) delete process.env.ARK_API_KEY;
  else process.env.ARK_API_KEY = prevArk;
  if (prevDash === undefined) delete process.env.DASHSCOPE_API_KEY;
  else process.env.DASHSCOPE_API_KEY = prevDash;
  if (prevExpand === undefined) delete process.env.TOOL_EXPAND_PROVIDER;
  else process.env.TOOL_EXPAND_PROVIDER = prevExpand;
  if (prevCutout === undefined) delete process.env.TOOL_CUTOUT_PROVIDER;
  else process.env.TOOL_CUTOUT_PROVIDER = prevCutout;
}

try {
  process.env.TOOL_IMAGE_PROVIDER = "mock";
  ok(
    "mock mode allows expand",
    assertToolProviderReady("expand").providerName.endsWith("-mock"),
  );

  process.env.TOOL_IMAGE_PROVIDER = "auto";
  delete process.env.ARK_API_KEY;
  delete process.env.DASHSCOPE_API_KEY;
  delete process.env.TOOL_EXPAND_HTTP_URL;
  process.env.TOOL_EXPAND_PROVIDER = "auto";
  process.env.TOOL_CUTOUT_PROVIDER = "auto";

  let cutoutBlocked = false;
  try {
    assertToolProviderReady("cutout");
  } catch (e) {
    cutoutBlocked =
      e instanceof Error && /暂不可用|未配置/.test(e.message);
  }
  ok("cutout blocked without keys", cutoutBlocked);

  process.env.ARK_API_KEY = "test-ark-key";
  ok(
    "cutout ok with ARK key",
    assertToolProviderReady("cutout").providerName === "tool-seedream",
  );

  delete process.env.ARK_API_KEY;
  process.env.DASHSCOPE_API_KEY = "test-dash-key";
  ok(
    "expand ok with dashscope",
    assertToolProviderReady("expand").providerName === "tool-wan-expand",
  );
} finally {
  restoreEnv();
}

const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} 通过\n`);
process.exit(failed > 0 ? 1 : 0);
