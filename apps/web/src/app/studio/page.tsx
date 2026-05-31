import type { CreationMode } from "@aimarket/ui";
import { StudioWorkspace } from "@/components/studio-workspace";
import { parseSessionKind } from "@/lib/session-kind";
import { randomUUID } from "@/lib/uuid";

export const metadata = {
  title: "创作页",
};

const modes: CreationMode[] = ["chat", "quick", "ecommerce"];

function parseMode(value?: string): CreationMode {
  if (value && modes.includes(value as CreationMode)) {
    return value as CreationMode;
  }
  return "chat";
}

type PageProps = {
  searchParams: Promise<{
    sessionId?: string;
    mode?: string;
    q?: string;
    jobId?: string;
    tool?: string;
    title?: string;
    kind?: string;
  }>;
};

export default async function StudioPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const sessionId = params.sessionId ?? randomUUID();
  const mode = parseMode(params.mode);
  const initialPrompt = params.q ?? "";
  const initialTitle =
    params.title ??
    (params.kind === "project" ? "新建项目" : params.kind === "canvas" ? "新建画布" : undefined);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#030303]">
      <StudioWorkspace
        key={sessionId}
        sessionId={sessionId}
        initialMode={mode}
        initialPrompt={initialPrompt}
        initialTitle={initialTitle}
        initialKind={parseSessionKind(params.kind)}
        initialJobId={params.jobId}
        initialToolId={params.tool}
      />
    </div>
  );
}
