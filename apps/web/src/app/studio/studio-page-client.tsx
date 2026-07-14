"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import type { CreationMode } from "@aimarket/ui";
import { StudioWorkspace } from "@/components/studio-workspace";
import { parseSessionKind } from "@/lib/session-kind";
import { getActiveWorkspaceId } from "@/lib/active-workspace";
import {
  getOrCreateDraftSessionId,
  writeDraftSessionId,
} from "@/lib/studio-draft-session";

const modes: CreationMode[] = ["chat", "image", "ecommerce", "production"];

function parseMode(value: string | null): CreationMode {
  if (value === "production" || value === "ecommerce") {
    return "image";
  }
  if (value && modes.includes(value as CreationMode)) {
    return value as CreationMode;
  }
  return "image";
}

function normalizeDeprecatedModes(searchParams: URLSearchParams): boolean {
  const mode = searchParams.get("mode");
  if (mode !== "production" && mode !== "ecommerce") {
    return false;
  }
  searchParams.set("mode", "image");
  return true;
}

export function StudioPageClient() {
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

  useEffect(() => {
    const url = new URL(window.location.href);
    if (!normalizeDeprecatedModes(url.searchParams)) return;
    window.history.replaceState(null, "", url.toString());
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get("submit") !== "1") return;
    const url = new URL(window.location.href);
    url.searchParams.delete("submit");
    window.history.replaceState(null, "", url.toString());
  }, [searchParams]);

  const mode = parseMode(searchParams.get("mode"));
  const kindParam = searchParams.get("kind");
  const remountKey = `${sessionId}-${mode}-${kindParam ?? "canvas"}`;
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
        key={remountKey}
        sessionId={sessionId}
        initialMode={mode}
        initialPrompt={searchParams.get("q") ?? ""}
        initialTitle={initialTitle ?? undefined}
        initialKind={parseSessionKind(kindParam ?? undefined)}
        initialJobId={searchParams.get("jobId") ?? undefined}
        initialToolId={searchParams.get("tool") ?? undefined}
        autoSubmitOnce={searchParams.get("submit") === "1"}
      />
    </div>
  );
}
