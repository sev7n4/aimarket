import type { CreationMode } from "@aimarket/ui";
import { StudioWorkspace } from "@/components/studio-workspace";

export const metadata = {
  title: "工作台",
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
  }>;
};

export default async function StudioPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const sessionId = params.sessionId ?? crypto.randomUUID();
  const mode = parseMode(params.mode);
  const initialPrompt = params.q ?? "";

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#030303] md:pl-14">
      <StudioWorkspace
        sessionId={sessionId}
        initialMode={mode}
        initialPrompt={initialPrompt}
        initialJobId={params.jobId}
        initialToolId={params.tool}
      />
    </div>
  );
}
