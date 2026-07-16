#!/usr/bin/env node
/**
 * Canvas connection UX 纯函数单测
 * pnpm --filter @aimarket/api exec sh -c 'TSX_TSCONFIG_PATH=../web/tsconfig.json tsx ../../scripts/test-canvas-connection-ux.ts'
 */
import {
  canConnectNodes,
  connectionDropIntent,
} from "../apps/web/src/lib/canvas-connection-ux.ts";
import {
  CanvasNodeType,
  type CanvasNodeData,
} from "../apps/web/src/components/infinite-canvas/types.ts";

const results: { name: string; pass: boolean }[] = [];

function assert(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

function node(
  partial: Partial<CanvasNodeData> & Pick<CanvasNodeData, "id" | "type">,
): CanvasNodeData {
  return {
    title: partial.title ?? partial.id,
    position: partial.position ?? { x: 0, y: 0 },
    width: partial.width ?? 280,
    height: partial.height ?? 200,
    ...partial,
  };
}

const audioSource = node({
  id: "audio-1",
  type: CanvasNodeType.Audio,
  title: "语音",
});

const imageSink = node({
  id: "img-1",
  type: CanvasNodeType.Image,
  title: "图片",
});

assert("AUDIO→IMAGE allows (workflow rules removed)", canConnectNodes(audioSource, imageSink).ok === true);

const imageSource = node({
  id: "img-2",
  type: CanvasNodeType.Image,
  title: "参考图",
});

const outpaintTarget = node({
  id: "outpaint-1",
  type: CanvasNodeType.Image,
  title: "扩图",
});

assert("IMAGE→IMAGE allows", canConnectNodes(imageSource, outpaintTarget).ok === true);

assert("self-connect rejects", !canConnectNodes(imageSource, imageSource).ok);

assert(
  "generic image target allows audio",
  canConnectNodes(
    audioSource,
    node({ id: "plain-img", type: CanvasNodeType.Image }),
  ).ok === true,
);

assert(
  "hit node → connect",
  connectionDropIntent("node-a", { x: 10, y: 20 }) === "connect",
);

assert(
  "no hit → create-at-drop",
  connectionDropIntent(null, { x: 100, y: 200 }) === "create-at-drop",
);

const failed = results.filter((r) => !r.pass).length;
if (failed > 0) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log(`\n${results.length} passed`);
