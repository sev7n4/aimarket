/**
 * Agent tool-response SSE 解析单测
 * pnpm --filter @aimarket/api exec sh -c 'TSX_TSCONFIG_PATH=../web/tsconfig.json tsx ../../scripts/test-agent-tool-stream-parse.ts'
 */

function parseSseBlock(block: string): { event: string; data: string } | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join("\n") };
}

const results: { name: string; pass: boolean }[] = [];
function ok(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

const deltaBlock = parseSseBlock('event: delta\ndata: {"delta":"你好"}');
ok("parse delta event", deltaBlock?.event === "delta");
ok(
  "parse delta payload",
  JSON.parse(deltaBlock?.data ?? "{}").delta === "你好",
);

const doneBlock = parseSseBlock(
  'event: done\ndata: {"content":"ok","toolCalls":[],"providerId":"mock"}',
);
ok("parse done event", doneBlock?.event === "done");
ok(
  "parse done content",
  JSON.parse(doneBlock?.data ?? "{}").content === "ok",
);

const failed = results.filter((r) => !r.pass);
if (failed.length) {
  console.error("\nFailed:", failed.map((f) => f.name).join(", "));
  process.exit(1);
}
console.log(`\n${results.length} passed`);
