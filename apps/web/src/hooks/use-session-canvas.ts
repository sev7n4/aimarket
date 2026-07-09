"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchCanvasBundle,
  fetchCanvasLayout,
  fetchMessages,
  saveCanvasLayout,
  type CanvasBundleDto,
  type CanvasLayoutDto,
} from "@/lib/api-client";
import type { CanvasConnection } from "@/components/infinite-canvas/types";
import { bindAgentPlaceholderOutputs } from "@/lib/agent-placeholder-bind";
import {
  applyPendingBatchLineage,
  buildCanvasItemsFromMessages,
  mergeCanvasItems,
  type CanvasItem,
  type PendingBatchLineage,
} from "@/lib/canvas-tools";
import type { ChatMessage } from "@/lib/types";

type CanvasBundle = {
  layout: CanvasLayoutDto;
  messages: ChatMessage[];
  canEdit: boolean;
};

const canvasBundleCache = new Map<string, CanvasBundle>();
const canvasBundleInflight = new Map<string, Promise<CanvasBundle>>();

function normalizeBundle(bundle: CanvasBundleDto): CanvasBundle {
  return {
    layout: bundle.layout ?? { version: 1, items: [] },
    messages: bundle.messages ?? [],
    canEdit: bundle.meta?.can_edit ?? true,
  };
}

async function fetchLegacyBundle(sessionId: string): Promise<CanvasBundle> {
  const [layout, msgRes] = await Promise.all([
    fetchCanvasLayout(sessionId).catch(() => ({
      version: 1 as const,
      items: [],
    })),
    fetchMessages(sessionId),
  ]);
  return {
    layout,
    messages: msgRes.messages,
    canEdit: msgRes.meta?.can_edit ?? true,
  };
}

async function loadCanvasBundle(sessionId: string, force = false) {
  if (!force) {
    const cached = canvasBundleCache.get(sessionId);
    if (cached) return cached;
    const inflight = canvasBundleInflight.get(sessionId);
    if (inflight) return inflight;
  }

  const promise = fetchCanvasBundle(sessionId)
    .then(normalizeBundle)
    .catch(() => fetchLegacyBundle(sessionId))
    .then((bundle) => {
      canvasBundleCache.set(sessionId, bundle);
      canvasBundleInflight.delete(sessionId);
      return bundle;
    })
    .catch((error) => {
      canvasBundleInflight.delete(sessionId);
      throw error;
    });
  canvasBundleInflight.set(sessionId, promise);
  return promise;
}

export function prefetchSessionCanvasBundle(sessionId: string) {
  void loadCanvasBundle(sessionId).catch(() => {});
}

export function invalidateSessionCanvasBundle(sessionId: string) {
  canvasBundleCache.delete(sessionId);
}

function toLayoutDto(
  items: CanvasItem[],
  infiniteConnections: CanvasConnection[],
  dramaNodePositions: Record<string, { x: number; y: number }>,
): CanvasLayoutDto {
  return {
    version: 1,
    infiniteConnections:
      infiniteConnections.length > 0
        ? infiniteConnections.map((c) => ({
            id: c.id,
            fromNodeId: c.fromNodeId,
            toNodeId: c.toNodeId,
          }))
        : undefined,
    dramaNodePositions:
      Object.keys(dramaNodePositions).length > 0
        ? dramaNodePositions
        : undefined,
    items: items.map((i) => ({
      id: i.id,
      url: i.url,
      thumbUrl: i.thumbUrl,
      x: i.x,
      y: i.y,
      width: i.width,
      height: i.height,
      label: i.label,
      isVideo: i.isVideo,
      source: i.source,
      role: i.role,
      assetId: i.assetId,
      outputId: i.outputId,
      batchId: i.batchId,
      batchIndex: i.batchIndex,
      batchTitle: i.batchTitle,
      batchSubtitle: i.batchSubtitle,
      parentBatchId: i.parentBatchId,
      sourceItemId: i.sourceItemId,
      infiniteNodeType: i.infiniteNodeType,
      infiniteNodeMeta: i.infiniteNodeMeta,
    })),
  };
}

export function useSessionCanvas(
  sessionId: string,
  enabled: boolean,
  options?: { autoLoad?: boolean },
) {
  const [items, setItems] = useState<CanvasItem[]>([]);
  const [infiniteConnections, setInfiniteConnections] = useState<CanvasConnection[]>([]);
  const [dramaNodePositions, setDramaNodePositions] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [canEdit, setCanEdit] = useState(true);
  const persistReady = useRef(false);
  const skipNextSave = useRef(true);
  const pendingLineageRef = useRef(new Map<string, PendingBatchLineage>());
  const activeSessionRef = useRef<string | null>(null);

  const withPendingLineage = useCallback((items: CanvasItem[]) => {
    return bindAgentPlaceholderOutputs(
      applyPendingBatchLineage(items, pendingLineageRef.current),
    );
  }, []);

  const registerBatchLineage = useCallback(
    (jobId: string, lineage: PendingBatchLineage) => {
      pendingLineageRef.current.set(jobId, lineage);
    },
    [],
  );

  const autoLoad = options?.autoLoad ?? true;

  useEffect(() => {
    activeSessionRef.current = sessionId;
    setItems([]);
    setInfiniteConnections([]);
    setDramaNodePositions({});
    setMessages([]);
    setCanEdit(true);
    persistReady.current = false;
    skipNextSave.current = true;
  }, [sessionId]);

  const load = useCallback(async (opts?: { force?: boolean }) => {
    activeSessionRef.current = sessionId;
    const bundle = await loadCanvasBundle(sessionId, opts?.force ?? false);
    if (activeSessionRef.current !== sessionId) return;
    setMessages(bundle.messages);
    setCanEdit(bundle.canEdit);
    const fromMsgs = buildCanvasItemsFromMessages(bundle.messages);
    const layout = bundle.layout;
    const saved = (layout.items ?? []) as CanvasItem[];
    let merged: CanvasItem[];
    if (opts?.force && fromMsgs.length > 0) {
      const savedByUrl = new Map(saved.map((i) => [i.url, i]));
      merged = fromMsgs.map((item) => {
        const prev = savedByUrl.get(item.url);
        return prev
          ? {
              ...item,
              x: prev.x,
              y: prev.y,
              width: prev.width,
              height: prev.height,
            }
          : item;
      });
      for (const item of saved) {
        if (
          (item.batchId === "uploads" || item.source === "upload") &&
          !merged.some((m) => m.url === item.url)
        ) {
          merged.push(item);
        }
      }
    } else {
      merged =
        saved.length > 0 ? mergeCanvasItems(saved, fromMsgs) : fromMsgs;
    }
    merged = withPendingLineage(merged);
    skipNextSave.current = true;
    setItems(merged);
    setInfiniteConnections(
      (layout.infiniteConnections ?? []).map((c) => ({
        id: c.id,
        fromNodeId: c.fromNodeId,
        toNodeId: c.toNodeId,
      })),
    );
    setDramaNodePositions(layout.dramaNodePositions ?? {});
    persistReady.current = true;
  }, [sessionId, withPendingLineage]);

  useEffect(() => {
    if (!enabled || !autoLoad) return;
    persistReady.current = false;
    void load();
  }, [autoLoad, enabled, load, sessionId]);

  const syncFromMessages = useCallback(
    (msgs: typeof messages) => {
      setMessages(msgs);
      setItems((prev) => {
        const incoming = buildCanvasItemsFromMessages(msgs);
        return withPendingLineage(mergeCanvasItems(prev, incoming));
      });
    },
    [withPendingLineage],
  );

  useEffect(() => {
    if (!persistReady.current || !enabled || !canEdit) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    const timer = setTimeout(() => {
      void saveCanvasLayout(
        sessionId,
        toLayoutDto(items, infiniteConnections, dramaNodePositions),
      )
        .then(() => invalidateSessionCanvasBundle(sessionId))
        .catch(() => {});
    }, 700);
    return () => clearTimeout(timer);
  }, [items, infiniteConnections, dramaNodePositions, sessionId, enabled, canEdit]);

  const updateItems = useCallback(
    (next: CanvasItem[] | ((prev: CanvasItem[]) => CanvasItem[])) => {
      if (!canEdit) return;
      setItems(next);
    },
    [canEdit],
  );

  const updateConnections = useCallback(
    (
      next:
        | CanvasConnection[]
        | ((prev: CanvasConnection[]) => CanvasConnection[]),
    ) => {
      if (!canEdit) return;
      setInfiniteConnections(next);
    },
    [canEdit],
  );

  const updateDramaPositions = useCallback(
    (
      next:
        | Record<string, { x: number; y: number }>
        | ((
            prev: Record<string, { x: number; y: number }>,
          ) => Record<string, { x: number; y: number }>),
    ) => {
      if (!canEdit) return;
      setDramaNodePositions(next);
    },
    [canEdit],
  );

  return {
    items,
    setItems: updateItems,
    infiniteConnections,
    setInfiniteConnections: updateConnections,
    dramaNodePositions,
    setDramaNodePositions: updateDramaPositions,
    messages,
    setMessages,
    load,
    syncFromMessages,
    registerBatchLineage,
    canEdit,
    setCanEdit,
  };
}
