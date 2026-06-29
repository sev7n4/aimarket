/**
 * P4.4 — computeRelatedNodeIds 单测
 *
 * 覆盖：单节点无边、相邻两节点、三节点链、四节点菱形、孤立节点、空边。
 *
 * pnpm exec tsx scripts/test-canvas-related-nodes.ts
 */
import {
  computeRelatedNodeIds,
  type RelatedEdge,
} from "../apps/web/src/lib/canvas-related-nodes.js";

const results: { name: string; pass: boolean }[] = [];
function ok(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}
function eqSet(name: string, got: Set<string>, want: string[]) {
  const wantSet = new Set(want);
  if (got.size !== wantSet.size) {
    ok(`${name} 大小不匹配（got=${got.size} want=${wantSet.size}）`, false);
    return;
  }
  for (const v of wantSet) {
    if (!got.has(v)) {
      ok(`${name} 缺 ${v}`, false);
      return;
    }
  }
  ok(name, true);
}

// 1) 空边
eqSet("空边 → 只含自己", computeRelatedNodeIds("a", []), ["a"]);

// 2) 简单两节点
const e1: RelatedEdge[] = [{ source: "a", target: "b" }];
eqSet("a→b：focus a", computeRelatedNodeIds("a", e1), ["a", "b"]);
eqSet("a→b：focus b（反向）", computeRelatedNodeIds("b", e1), ["a", "b"]);

// 3) 三节点链 a→b→c
const e2: RelatedEdge[] = [
  { source: "a", target: "b" },
  { source: "b", target: "c" },
];
eqSet("a→b→c：focus a", computeRelatedNodeIds("a", e2), ["a", "b", "c"]);
eqSet("a→b→c：focus b", computeRelatedNodeIds("b", e2), ["a", "b", "c"]);
eqSet("a→b→c：focus c（反向全链）", computeRelatedNodeIds("c", e2), [
  "a",
  "b",
  "c",
]);

// 4) 菱形 a→b, a→c, b→d, c→d
const e3: RelatedEdge[] = [
  { source: "a", target: "b" },
  { source: "a", target: "c" },
  { source: "b", target: "d" },
  { source: "c", target: "d" },
];
eqSet("菱形 focus a", computeRelatedNodeIds("a", e3), ["a", "b", "c", "d"]);
eqSet("菱形 focus d（反向）", computeRelatedNodeIds("d", e3), [
  "a",
  "b",
  "c",
  "d",
]);
eqSet("菱形 focus b", computeRelatedNodeIds("b", e3), ["a", "b", "c", "d"]);

// 5) 孤立节点
const e4: RelatedEdge[] = [
  { source: "a", target: "b" },
  { source: "x", target: "y" }, // 孤立分支
];
eqSet("focus a 不含 x/y", computeRelatedNodeIds("a", e4), ["a", "b"]);

// 6) 焦点不在任何边里
eqSet("焦点孤立", computeRelatedNodeIds("ghost", e4), ["ghost"]);

// 7) 自环 a→a
const e5: RelatedEdge[] = [{ source: "a", target: "a" }];
eqSet("自环只含 a", computeRelatedNodeIds("a", e5), ["a"]);

// 8) 大图性能烟雾（100 节点链）
const big: RelatedEdge[] = [];
for (let i = 0; i < 99; i++) {
  big.push({ source: `n${i}`, target: `n${i + 1}` });
}
const t0 = Date.now();
const bigRelated = computeRelatedNodeIds("n0", big);
const dt = Date.now() - t0;
ok(`大图 100 节点 < 50ms（实际 ${dt}ms）`, dt < 50);
ok(`大图含 100 节点`, bigRelated.size === 100);

const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} 通过\n`);
process.exit(failed > 0 ? 1 : 0);
