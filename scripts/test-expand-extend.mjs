import assert from "node:assert/strict";
import {
  resolveExpandScales,
} from "../apps/api/src/lib/expand-extend.ts";

const left = resolveExpandScales({ direction: "left" });
assert.equal(left.left_scale, 1.25);
assert.equal(left.right_scale, 1);

const explicit = resolveExpandScales({
  top: 1.5,
  left: 1.2,
});
assert.equal(explicit.top_scale, 1.5);
assert.equal(explicit.left_scale, 1.2);
assert.equal(explicit.right_scale, 1);

console.log("expand-extend scales OK");
