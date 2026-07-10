/**
 * canvas clipboard 单测
 * pnpm --filter @aimarket/api exec sh -c 'TSX_TSCONFIG_PATH=../web/tsconfig.json tsx ../../scripts/test-canvas-clipboard.ts'
 */
import { CanvasNodeType } from "../apps/web/src/components/infinite-canvas/types";
import {
  pasteClipboard,
  selectAllNodeIds,
  serializeSelection,
} from "../apps/web/src/lib/canvas-clipboard.ts";

const results: { name: string; pass: boolean }[] = [];
function ok(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

const nodes = [
  {
    id: "n1",
    type: CanvasNodeType.Image,
    title: "A",
    position: { x: 10, y: 20 },
    width: 100,
    height: 80,
    metadata: { workflowToolType: "TEXT_TO_IMAGE", status: "success" as const },
  },
  {
    id: "n2",
    type: CanvasNodeType.Image,
    title: "B",
    position: { x: 200, y: 20 },
    width: 100,
    height: 80,
  },
  {
    id: "n3",
    type: CanvasNodeType.Text,
    title: "C",
    position: { x: 400, y: 20 },
    width: 100,
    height: 40,
  },
];
const connections = [
  { id: "c1", fromNodeId: "n1", toNodeId: "n2" },
  { id: "c2", fromNodeId: "n2", toNodeId: "n3" },
];

ok("selectAll returns all ids", selectAllNodeIds(nodes).join(",") === "n1,n2,n3");

const payload = serializeSelection(nodes, connections, ["n1", "n2"]);
ok("serialize keeps 2 nodes", payload?.nodes.length === 2);
ok("serialize keeps internal edge", payload?.connections.length === 1);
ok("serialize drops external edge", payload?.connections[0]?.fromNodeId === "n1");

const empty = serializeSelection(nodes, connections, []);
ok("empty selection null", empty === null);

const pasted = pasteClipboard(payload!, { x: 40, y: 40 });
ok("paste regenerates ids", pasted.nodes.every((n) => n.id !== "n1" && n.id !== "n2"));
ok("paste offsets position", pasted.nodes[0]?.position.x === 50);
ok("paste remaps connection", pasted.connections.length === 1);
ok(
  "paste connection uses new ids",
  pasted.connections[0]!.fromNodeId === pasted.nodes[0]!.id &&
    pasted.connections[0]!.toNodeId === pasted.nodes[1]!.id,
);
ok(
  "paste clears job metadata",
  pasted.nodes[0]?.metadata?.status === "idle" &&
    pasted.nodes[0]?.metadata?.workflowJobId === undefined,
);

const failed = results.filter((r) => !r.pass);
if (failed.length) {
  console.error("\nFailed:", failed.map((f) => f.name).join(", "));
  process.exit(1);
}
console.log(`\n${results.length} passed`);
