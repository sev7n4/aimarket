"use client";

import { DramaPlanDocumentPanel } from "@/components/drama-plan-document-panel";
import { DramaPlanTaskChain } from "@/components/drama-plan-task-chain";
import type { DramaPlanStreamEvent } from "@/lib/drama-plan-stream";
import type { DramaProjectPayload } from "@/lib/types";

interface DramaAgentPlanWorkspaceProps {
  sessionId?: string;
  prompt: string;
  events: DramaPlanStreamEvent[];
  currentAgent?: string | null;
  partialProject?: DramaProjectPayload | null;
  status?: "planning" | "completed" | "failed";
  error?: string | null;
  refreshKey?: string | number;
  onRerunFromAgent?: (agent: string) => void;
  rerunBusy?: boolean;
  onConfirmProduce?: () => void;
  produceBusy?: boolean;
  produceHint?: string | null;
}

/** Seko 式：左 45% 任务链 + 右 55% 策划文档 */
export function DramaAgentPlanWorkspace({
  sessionId,
  prompt,
  events,
  currentAgent,
  partialProject,
  status = "planning",
  error,
  refreshKey,
  onRerunFromAgent,
  rerunBusy,
  onConfirmProduce,
  produceBusy,
  produceHint,
}: DramaAgentPlanWorkspaceProps) {
  return (
    <div
      data-testid="drama-agent-plan-workspace"
      className="flex h-full min-h-[320px] flex-col overflow-hidden rounded-xl border border-violet-500/15 bg-black/30 lg:flex-row"
    >
      <div className="flex min-h-0 w-full shrink-0 flex-col border-b border-white/5 lg:w-[45%] lg:border-b-0 lg:border-r">
        <DramaPlanTaskChain
          sessionId={sessionId}
          prompt={prompt}
          currentAgent={currentAgent}
          events={events}
          status={status}
          error={error}
          refreshKey={refreshKey}
          onRerunFromAgent={onRerunFromAgent}
          rerunBusy={rerunBusy}
        />
      </div>
      <div className="min-h-0 w-full flex-1 lg:w-[55%]">
        <DramaPlanDocumentPanel
          partialProject={partialProject}
          currentAgent={currentAgent}
          events={events}
          status={status}
          planTitle={partialProject?.script?.title}
          onConfirmProduce={onConfirmProduce}
          produceBusy={produceBusy}
          produceHint={produceHint}
        />
      </div>
    </div>
  );
}
