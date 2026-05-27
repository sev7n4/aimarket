"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchCanvasLayout,
  fetchMessages,
  saveCanvasLayout,
  type CanvasLayoutDto,
} from "@/lib/api-client";
import {
  buildCanvasItemsFromMessages,
  mergeCanvasItems,
  type CanvasItem,
} from "@/lib/canvas-tools";

function toLayoutDto(items: CanvasItem[]): CanvasLayoutDto {
  return {
    version: 1,
    items: items.map((i) => ({
      id: i.id,
      url: i.url,
      x: i.x,
      y: i.y,
      width: i.width,
      height: i.height,
      label: i.label,
      isVideo: i.isVideo,
      source: i.source,
      role: i.role,
      assetId: i.assetId,
    })),
  };
}

export function useSessionCanvas(sessionId: string, enabled: boolean) {
  const [items, setItems] = useState<CanvasItem[]>([]);
  const [messages, setMessages] = useState<
    Awaited<ReturnType<typeof fetchMessages>>["messages"]
  >([]);
  const [canEdit, setCanEdit] = useState(true);
  const persistReady = useRef(false);
  const skipNextSave = useRef(true);

  const load = useCallback(async () => {
    const [layout, msgRes] = await Promise.all([
      fetchCanvasLayout(sessionId).catch(() => ({
        version: 1 as const,
        items: [],
      })),
      fetchMessages(sessionId),
    ]);
    setMessages(msgRes.messages);
    setCanEdit(msgRes.meta?.can_edit ?? true);
    const fromMsgs = buildCanvasItemsFromMessages(msgRes.messages);
    const saved = (layout.items ?? []) as CanvasItem[];
    const merged =
      saved.length > 0 ? mergeCanvasItems(saved, fromMsgs) : fromMsgs;
    skipNextSave.current = true;
    setItems(merged);
    persistReady.current = true;
  }, [sessionId]);

  useEffect(() => {
    if (!enabled) return;
    persistReady.current = false;
    void load();
  }, [enabled, load, sessionId]);

  const syncFromMessages = useCallback(
    (msgs: typeof messages) => {
      setMessages(msgs);
      setItems((prev) => {
        const incoming = buildCanvasItemsFromMessages(msgs);
        return mergeCanvasItems(prev, incoming);
      });
    },
    [],
  );

  useEffect(() => {
    if (!persistReady.current || !enabled || !canEdit) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    const timer = setTimeout(() => {
      void saveCanvasLayout(sessionId, toLayoutDto(items)).catch(() => {});
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
    canEdit,
    setCanEdit,
  };
}
