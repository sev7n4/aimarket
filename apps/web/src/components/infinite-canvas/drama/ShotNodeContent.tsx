import {
  DramaShotCardShell,
  dramaShotDisplayFromNode,
} from "@/components/drama/drama-shot-card-shell";
import type { CanvasNodeData } from "../types";

type ShotNodeContentProps = {
  node: CanvasNodeData;
};

export function ShotNodeContent({ node }: ShotNodeContentProps) {
  return (
    <DramaShotCardShell
      mode="node"
      shot={dramaShotDisplayFromNode(node)}
      testId="drama-canvas-shot-card"
    />
  );
}
