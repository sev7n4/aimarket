import { useCallback, useEffect } from "react";
import type { CreationMode } from "@aimarket/ui";
import type { ImageSession, StudioTool } from "@/lib/types";
import {
  ensureSession,
  fetchSession,
  fetchTools,
  listSessions,
} from "@/lib/api-client";
import { getActiveWorkspaceId } from "@/lib/active-workspace";
import { consumePendingAssets, type PendingAsset } from "@/lib/pending-assets";
import { consumePendingInspiration, normalizePendingInspiration } from "@/lib/pending-inspiration";
import {
  coerceInspirationAspect,
  consumePendingDramaTemplate,
  importInspirationReferencesToCanvas,
  type StudioInspirationApply,
} from "@/lib/inspiration-studio";
import type { DramaTemplateMetadata } from "@/lib/types";
import { persistCreationLane } from "@/lib/creation-dock-prefs";
import { writeDraftSessionId } from "@/lib/studio-draft-session";
import { type SessionKind } from "@/lib/session-kind";

/** Studio 侧栏会话列表：拉取上限（API 按 updated_at 降序） */
export const STUDIO_SIDEBAR_SESSION_LIMIT = 200;

export interface UseStudioSessionBootstrapParams {
  sessionId: string;
  mode: CreationMode;
  initialTitle?: string;
  initialKind?: SessionKind;
  user: { id: string } | null;
  authLoading: boolean;
  activeWorkspaceId: string | null;
  loadCanvas: (opts?: { force?: boolean }) => Promise<void>;
  setCanvasItems: React.Dispatch<React.SetStateAction<import("@/lib/canvas-tools").CanvasItem[]>>;
  setCanEdit: (canEdit: boolean) => void;
  setSelectedCanvasId: (id: string | null) => void;
  setRestoredAssets: React.Dispatch<React.SetStateAction<PendingAsset[]>>;
  setInspirationApply: React.Dispatch<
    React.SetStateAction<StudioInspirationApply | null>
  >;
  setDramaTemplateApply: React.Dispatch<
    React.SetStateAction<DramaTemplateMetadata | null>
  >;
  setStudioPrompt: React.Dispatch<React.SetStateAction<string>>;
  setSessions: React.Dispatch<React.SetStateAction<ImageSession[]>>;
  setTools: React.Dispatch<React.SetStateAction<StudioTool[]>>;
  setReady: React.Dispatch<React.SetStateAction<boolean>>;
  setFetchedSessionTitle: React.Dispatch<React.SetStateAction<string | null>>;
  setActiveWorkspaceId: React.Dispatch<React.SetStateAction<string | null>>;
}

export function useStudioSessionBootstrap({
  sessionId,
  mode,
  initialTitle,
  initialKind,
  user,
  authLoading,
  activeWorkspaceId,
  loadCanvas,
  setCanvasItems,
  setCanEdit,
  setSelectedCanvasId,
  setRestoredAssets,
  setInspirationApply,
  setDramaTemplateApply,
  setStudioPrompt,
  setSessions,
  setTools,
  setReady,
  setFetchedSessionTitle,
  setActiveWorkspaceId,
}: UseStudioSessionBootstrapParams) {
  const applySourceInspiration = useCallback(
    (src: NonNullable<Awaited<ReturnType<typeof ensureSession>>["sourceInspiration"]>) => {
      const normalized = normalizePendingInspiration({
        id: src.id,
        title: src.title,
        prompt: src.prompt,
        modelId: src.modelId,
        aspectRatio: coerceInspirationAspect(src.aspectRatio),
        resolution: src.resolution,
        variables: src.variables,
        variableValues: src.variableValues ?? {},
        referenceUrls: src.referenceUrls ?? [],
        creationLane: src.mediaType === "video" ? "video" : undefined,
      });
      persistCreationLane("studio", normalized.creationLane);
      setInspirationApply({
        ...normalized,
        aspectRatio: coerceInspirationAspect(normalized.aspectRatio),
        applyKey: 1,
      });
    },
    [setInspirationApply],
  );

  const initSession = useCallback(async () => {
    if (!user) return;
    const pending = consumePendingAssets(sessionId);
    if (pending.length) setRestoredAssets(pending);

    const pendingRaw = consumePendingInspiration(sessionId);
    const pendingInspiration = pendingRaw
      ? normalizePendingInspiration(pendingRaw)
      : null;
    const pendingDramaTemplate = consumePendingDramaTemplate(sessionId);
    if (pendingDramaTemplate) {
      const { inspirationId: _inspId, title: _title, ...tpl } = pendingDramaTemplate;
      setDramaTemplateApply(tpl);
      if (tpl.userIdea) {
        setStudioPrompt(tpl.userIdea);
      }
    }
    if (pendingInspiration) {
      persistCreationLane("studio", pendingInspiration.creationLane);
      setInspirationApply({
        ...pendingInspiration,
        aspectRatio: coerceInspirationAspect(pendingInspiration.aspectRatio),
        applyKey: 1,
      });
    }

    const wsId = activeWorkspaceId ?? getActiveWorkspaceId() ?? undefined;
    writeDraftSessionId(sessionId, wsId);

    const mustPersist = pending.length > 0 || pendingInspiration != null;
    let existing: Awaited<ReturnType<typeof fetchSession>> | null = null;
    if (!mustPersist) {
      try {
        existing = await fetchSession(sessionId);
      } catch {
        existing = null;
      }
    }

    if (mustPersist) {
      const ensured = await ensureSession(sessionId, mode, {
        title: initialTitle ?? pendingInspiration?.title,
        kind:
          pendingInspiration ?
            pendingInspiration.creationLane === "video" ?
              "canvas"
            : "project"
          : (initialKind ?? "canvas"),
        workspaceId: wsId,
        sourceInspirationId: pendingInspiration?.id,
      });
      setCanEdit(ensured.can_edit ?? true);
      if (!pendingInspiration && ensured.sourceInspiration) {
        applySourceInspiration(ensured.sourceInspiration);
        if (
          mode === "production" &&
          ensured.sourceInspiration.dramaTemplate
        ) {
          setDramaTemplateApply(ensured.sourceInspiration.dramaTemplate);
          setStudioPrompt(ensured.sourceInspiration.dramaTemplate.userIdea);
        }
      }
      await loadCanvas();
      if (pendingInspiration?.referenceUrls.length) {
        const refItems = await importInspirationReferencesToCanvas(
          sessionId,
          pendingInspiration.referenceUrls,
        );
        setCanvasItems((prev) => [...prev, ...refItems]);
        if (refItems[0]) setSelectedCanvasId(refItems[0].id);
      }
    } else if (existing) {
      setCanEdit(existing.can_edit ?? true);
      if (existing.title) setFetchedSessionTitle(existing.title);
      if (!pendingInspiration && existing.sourceInspiration) {
        applySourceInspiration(existing.sourceInspiration);
        if (
          mode === "production" &&
          existing.sourceInspiration.dramaTemplate &&
          !pendingDramaTemplate
        ) {
          setDramaTemplateApply(existing.sourceInspiration.dramaTemplate);
          setStudioPrompt(existing.sourceInspiration.dramaTemplate.userIdea);
        }
      }
      await loadCanvas();
    } else {
      setCanEdit(true);
    }

    const listPromise = listSessions(
      STUDIO_SIDEBAR_SESSION_LIMIT,
      undefined,
      wsId,
    );
    const toolsPromise = fetchTools().catch(() => []);
    setReady(true);
    const [list, toolList] = await Promise.all([listPromise, toolsPromise]);
    setSessions(list);
    setTools(toolList);
  }, [
    user,
    sessionId,
    mode,
    initialTitle,
    initialKind,
    loadCanvas,
    setCanvasItems,
    activeWorkspaceId,
    setCanEdit,
    applySourceInspiration,
    setRestoredAssets,
    setInspirationApply,
    setDramaTemplateApply,
    setStudioPrompt,
    setSessions,
    setTools,
    setReady,
    setFetchedSessionTitle,
    setSelectedCanvasId,
  ]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setReady(true);
      fetchTools().then(setTools).catch(() => setTools([]));
      return;
    }
    const stored = getActiveWorkspaceId();
    if (stored) setActiveWorkspaceId(stored);
    setReady(false);
    initSession().catch(() => setReady(true));
  }, [authLoading, user, sessionId, initSession, setReady, setTools, setActiveWorkspaceId]);

  return { initSession };
}
