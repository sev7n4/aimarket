"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import type { CreationMode } from "@aimarket/ui";
import { StudioWorkspace } from "@/components/studio-workspace";
import { parseSessionKind } from "@/lib/session-kind";
import {
  getOrCreateDraftSessionId,
  writeDraftSessionId,
} from "@/lib/studio-draft-session";

const modes: CreationMode[] = ["chat", "image", "ecommerce"];

function parseMode(value: string | null): CreationMode {
  if (value && modes.includes(value as CreationMode)) {
    return value as CreationMode;
  }
  return "image";
}

export function StudioPageClient() {
  const searchParams = useSearchParams();
  const sessionIdFromUrl = searchParams.get("sessionId");

  const sessionId = useMemo(
    () => sessionIdFromUrl ?? getOrCreateDraftSessionId(),
    [sessionIdFromUrl],
  );

  useEffect(() => {
    if (sessionIdFromUrl) {
      writeDraftSessionId(sessionIdFromUrl);
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set("sessionId", sessionId);
    window.history.replaceState(null, "", url.toString());
    writeDraftSessionId(sessionId);
  }, [sessionId, sessionIdFromUrl]);

  const mode = parseMode(searchParams.get("mode"));
  const kindParam = searchParams.get("kind");
  const workspaceKey =
    searchParams.toString() ||
    `${sessionIdFromUrl ?? sessionId}-${mode}-${kindParam ?? "canvas"}`;
  const initialTitle =
    searchParams.get("title") ??
    (kindParam === "project"
      ? "新建项目"
      : kindParam === "canvas"
        ? "新建画布"
        : undefined);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#030303]">
      <StudioWorkspace
        key={workspaceKey}
        sessionId={sessionId}
        initialMode={mode}
        initialPrompt={searchParams.get("q") ?? ""}
        initialTitle={initialTitle ?? undefined}
        initialKind={parseSessionKind(kindParam ?? undefined)}
        initialJobId={searchParams.get("jobId") ?? undefined}
        initialToolId={searchParams.get("tool") ?? undefined}
      />
    </div>
  );
}
