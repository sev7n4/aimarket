"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { StudioWorkspace } from "@/components/studio-workspace";
import { getActiveWorkspaceId } from "@/lib/active-workspace";
import {
  getOrCreateDraftSessionId,
  writeDraftSessionId,
} from "@/lib/studio-draft-session";

/**
 * NeoWOW 式工作流入口：/workflow?sessionId=...
 * 左无限画布 + 右 Agent 对话，复用 Studio 会话与生成链路。
 */
export function WorkflowPageClient() {
  const searchParams = useSearchParams();
  const sessionIdFromUrl = searchParams.get("sessionId");

  const sessionId = useMemo(() => {
    const wsId = getActiveWorkspaceId();
    return sessionIdFromUrl ?? getOrCreateDraftSessionId(wsId);
  }, [sessionIdFromUrl]);

  useEffect(() => {
    const wsId = getActiveWorkspaceId();
    if (sessionIdFromUrl) {
      writeDraftSessionId(sessionIdFromUrl, wsId);
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set("sessionId", sessionId);
    window.history.replaceState(null, "", url.toString());
    writeDraftSessionId(sessionId, wsId);
  }, [sessionId, sessionIdFromUrl]);

  return (
    <div
      className="flex h-dvh flex-col overflow-hidden bg-[#0f0f0f]"
      data-testid="workflow-page"
    >
      <StudioWorkspace
        key={sessionId}
        sessionId={sessionId}
        initialMode="chat"
        initialPrompt={searchParams.get("q") ?? ""}
        initialTitle={searchParams.get("title") ?? "未命名工作流"}
        initialKind="canvas"
        workflowShell
      />
    </div>
  );
}
