import type { CreationMode } from "@aimarket/ui";
import { type SessionKind } from "@/lib/session-kind";

export interface StudioWorkspaceProps {
  sessionId: string;
  initialMode: CreationMode;
  initialPrompt: string;
  initialTitle?: string;
  initialKind?: SessionKind;
  initialJobId?: string;
  initialToolId?: string;
  autoSubmitOnce?: boolean;
}
