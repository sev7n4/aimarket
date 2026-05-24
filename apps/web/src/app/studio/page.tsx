import type { CreationMode } from "@aimarket/ui";
import { StudioWorkspace } from "@/components/studio-workspace";
import { SiteHeader } from "@/components/site-header";

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
  }>;
};

export default async function StudioPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const sessionId = params.sessionId ?? crypto.randomUUID();
  const mode = parseMode(params.mode);
  const initialPrompt = params.q ?? "";

  return (
    <div className="flex min-h-dvh flex-col bg-[#030303]">
      <SiteHeader />
      <StudioWorkspace
        sessionId={sessionId}
        initialMode={mode}
        initialPrompt={initialPrompt}
      />
    </div>
  );
}
