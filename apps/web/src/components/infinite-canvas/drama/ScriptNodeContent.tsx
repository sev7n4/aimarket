import {
  DramaScriptCardShell,
  dramaScriptDisplayFromNode,
} from "@/components/drama/drama-script-card-shell";
import type { CanvasNodeData } from "../types";

type ScriptNodeContentProps = {
  node: CanvasNodeData;
};

export function ScriptNodeContent({ node }: ScriptNodeContentProps) {
  return (
    <DramaScriptCardShell
      mode="node"
      script={dramaScriptDisplayFromNode(node)}
      testId="drama-canvas-script-card"
    />
  );
}
