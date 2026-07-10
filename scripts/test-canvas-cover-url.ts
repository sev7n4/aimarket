/**
 * canvas_layout 封面提取单测
 * pnpm --filter @aimarket/api exec tsx ../../scripts/test-canvas-cover-url.ts
 */
import {
  extractCanvasCoverUrl,
  serializeCanvasLayout,
} from "../apps/api/src/lib/canvas-layout.ts";

const results: { name: string; pass: boolean }[] = [];

function ok(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

ok("null layout", extractCanvasCoverUrl(null) === null);
ok("empty items", extractCanvasCoverUrl('{"version":1,"items":[]}') === null);

const withItem = serializeCanvasLayout({
  version: 1,
  items: [
    {
      id: "img-1",
      url: "/uploads/wf/cover.png",
      x: 0,
      y: 0,
      width: 200,
      height: 200,
    },
  ],
});
ok(
  "item url",
  extractCanvasCoverUrl(withItem) === "/uploads/wf/cover.png",
);

const withMeta = serializeCanvasLayout({
  version: 1,
  items: [
    {
      id: "wf-1",
      url: "",
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      infiniteNodeMeta: {
        content: "https://cdn.example.com/out.png",
      },
    },
  ],
});
ok(
  "infiniteNodeMeta content",
  extractCanvasCoverUrl(withMeta) === "https://cdn.example.com/out.png",
);

const failed = results.filter((r) => !r.pass);
if (failed.length) {
  console.error("\nFailed:", failed.map((f) => f.name).join(", "));
  process.exit(1);
}
console.log(`\n${results.length} passed`);
