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

function toLayoutDto(items: CanvasItem[]): CanvasLayoutDto {
  return {
    version: 1,
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
    })),
  };
}

export function useSessionCanvas(
  sessionId: string,
  enabled: boolean,
  options?: { autoLoad?: boolean },
) {
  const [items, setItems] = useState<CanvasItem[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [canEdit, setCanEdit] = useState(true);
  const persistReady = useRef(false);
  const skipNextSave = useRef(true);
  const pendingLineageRef = useRef(new Map<string, PendingBatchLineage>());
  const activeSessionRef = useRef<string | null>(null);

  const withPendingLineage = useCallback((items: CanvasItem[]) => {
    return applyPendingBatchLineage(items, pendingLineageRef.current);
  }, []);

  const registerBatchLineage = useCallback(
    (jobId: string, lineage: PendingBatchLineage) => {
      pendingLineageRef.current.set(jobId, lineage);
    },
    [],
  );

  const autoLoad = options?.autoLoad ?? true;

  const load = useCallback(async (opts?: { force?: boolean }) => {
    activeSessionRef.current = sessionId;
    const bundle = await loadCanvasBundle(sessionId, opts?.force ?? false);
    if (activeSessionRef.current !== sessionId) return;
    setMessages(bundle.messages);
    setCanEdit(bundle.canEdit);
    const fromMsgs = buildCanvasItemsFromMessages(bundle.messages);
    const layout = bundle.layout;
    const saved = (layout.items ?? []) as CanvasItem[];
    const merged = withPendingLineage(
      saved.length > 0 ? mergeCanvasItems(saved, fromMsgs) : fromMsgs,
    );
    skipNextSave.current = true;
    setItems(merged);
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
      void saveCanvasLayout(sessionId, toLayoutDto(items))
        .then(() => invalidateSessionCanvasBundle(sessionId))
        .catch(() => {});
    }, 700);
    return () => clearTimeout(timer);
  }, [items, sessionId, enabled, canEdit]);

  const updateItems = useCallback(
    (next: CanvasItem[] | ((prev: CanvasItem[]) => CanvasItem[])) => {
      if (!canEdit) return;
      setItems(next);
    },
    [canEdit],
  );

  return {
    items,
    setItems: updateItems,
    messages,
    setMessages,
    load,
    syncFromMessages,
    registerBatchLineage,
    canEdit,
    setCanEdit,
  };
}
