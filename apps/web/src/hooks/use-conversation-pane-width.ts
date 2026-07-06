"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "aimarket.studio.conversationPaneWidth";
export const CONVERSATION_PANE_DEFAULT_WIDTH = 340;
export const CONVERSATION_PANE_MIN_WIDTH = 240;
export const CONVERSATION_PANE_MAX_WIDTH = 560;

function readStoredWidth(): number {
  if (typeof window === "undefined") return CONVERSATION_PANE_DEFAULT_WIDTH;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  if (
    Number.isFinite(parsed) &&
    parsed >= CONVERSATION_PANE_MIN_WIDTH &&
    parsed <= CONVERSATION_PANE_MAX_WIDTH
  ) {
    return parsed;
  }
  return CONVERSATION_PANE_DEFAULT_WIDTH;
}

/** Agent 车道左对话栏宽度（可拖拽，localStorage 持久化） */
export function useConversationPaneWidth() {
  const [width, setWidth] = useState(CONVERSATION_PANE_DEFAULT_WIDTH);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    setWidth(readStoredWidth());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, String(width));
  }, [width]);

  const handleDragStart = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDrag = useCallback((event: MouseEvent) => {
    setWidth((prev) => {
      const next = Math.round(
        Math.min(
          CONVERSATION_PANE_MAX_WIDTH,
          Math.max(CONVERSATION_PANE_MIN_WIDTH, prev + event.movementX),
        ),
      );
      return next;
    });
  }, []);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    window.addEventListener("mousemove", handleDrag);
    window.addEventListener("mouseup", handleDragEnd);
    return () => {
      window.removeEventListener("mousemove", handleDrag);
      window.removeEventListener("mouseup", handleDragEnd);
    };
  }, [isDragging, handleDrag, handleDragEnd]);

  return { width, isDragging, handleDragStart };
}
