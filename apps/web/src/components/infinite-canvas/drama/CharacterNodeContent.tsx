import {
  DramaCharacterCardShell,
  dramaCharacterDisplayFromNode,
} from "@/components/drama/drama-character-card-shell";
import type { CanvasNodeData } from "../types";

type CharacterNodeContentProps = {
  node: CanvasNodeData;
};

export function CharacterNodeContent({ node }: CharacterNodeContentProps) {
  return (
    <DramaCharacterCardShell
      mode="node"
      character={dramaCharacterDisplayFromNode(node)}
      testId="drama-canvas-character-card"
    />
  );
}
