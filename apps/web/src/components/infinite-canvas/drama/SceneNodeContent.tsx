import {
  DramaSceneCardShell,
  dramaSceneDisplayFromNode,
} from "@/components/drama/drama-scene-card-shell";
import type { CanvasNodeData } from "../types";

type SceneNodeContentProps = {
  node: CanvasNodeData;
};

export function SceneNodeContent({ node }: SceneNodeContentProps) {
  return (
    <DramaSceneCardShell
      mode="node"
      scene={dramaSceneDisplayFromNode(node)}
      testId="drama-canvas-scene-card"
    />
  );
}
