import { describe, expect, it } from "vitest";
import { CanvasNodeType, type CanvasNodeData } from "@/components/infinite-canvas/types";
import {
  dramaShotIdFromNodeId,
  resolveNodeToolPrompt,
  resolveNodeToolReferences,
} from "./infinite-node-tool-run";

describe("infinite-node-tool-run", () => {
  it("resolves prompt from shot metadata", () => {
    const node: CanvasNodeData = {
      id: "drama-shot-s1",
      type: CanvasNodeType.Shot,
      title: "分镜 #1",
      position: { x: 0, y: 0 },
      width: 360,
      height: 260,
      metadata: { visualPrompt: "雨夜街道" },
    };
    expect(resolveNodeToolPrompt(node)).toBe("雨夜街道");
  });

  it("resolves keyframe reference for drama shot", () => {
    const node: CanvasNodeData = {
      id: "drama-shot-s1",
      type: CanvasNodeType.Shot,
      title: "分镜",
      position: { x: 0, y: 0 },
      width: 360,
      height: 260,
      metadata: { keyframeOutputId: "out-abc" },
    };
    expect(resolveNodeToolReferences(node, null)).toEqual({
      referenceOutputIds: ["out-abc"],
    });
  });

  it("extracts drama shot id from node id", () => {
    expect(dramaShotIdFromNodeId("drama-shot-abc-123")).toBe("abc-123");
    expect(dramaShotIdFromNodeId("img-1")).toBeNull();
  });
});
