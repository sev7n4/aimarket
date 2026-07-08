"use client";

import { useCallback, useEffect, useState } from "react";

type Options = {
  storageKey: string;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
};

export function useResizablePanelWidth({
  storageKey,
  defaultWidth,
  minWidth,
  maxWidth,
}: Options) {
  const [width, setWidth] = useState(defaultWidth);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return;
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      setWidth(Math.min(maxWidth, Math.max(minWidth, parsed)));
    }
  }, [storageKey, minWidth, maxWidth]);

  const persist = useCallback(
    (next: number) => {
      const clamped = Math.min(maxWidth, Math.max(minWidth, next));
      setWidth(clamped);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(storageKey, String(clamped));
      }
    },
    [storageKey, minWidth, maxWidth],
  );

  const onResizeStart = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = width;
      setDragging(true);

      const onMove = (moveEvent: MouseEvent) => {
        const delta = startX - moveEvent.clientX;
        persist(startWidth + delta);
      };
      const onUp = () => {
        setDragging(false);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [persist, width],
  );

  return { width, dragging, onResizeStart, setWidth: persist };
}
