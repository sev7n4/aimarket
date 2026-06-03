"use client";

import { useCallback, useMemo, useState } from "react";
import type { CanvasMaskSelection } from "@/lib/canvas-tools";

export type MaskBox = { x: number; y: number; width: number; height: number };
export type MaskPoint = { x: number; y: number };
export type MaskStroke = MaskPoint[];

type MaskSnapshot = {
  strokes: MaskStroke[];
  boxes: MaskBox[];
};

function cloneSnapshot(s: MaskSnapshot): MaskSnapshot {
  return {
    strokes: s.strokes.map((st) => st.map((p) => ({ ...p }))),
    boxes: s.boxes.map((b) => ({ ...b })),
  };
}

export function defaultBrushSize(imgW: number, imgH: number): number {
  return Math.max(12, Math.round(Math.min(imgW, imgH) * 0.04));
}

export function useMaskBrush(imageWidth: number, imageHeight: number) {
  const [maskStrokes, setMaskStrokes] = useState<MaskStroke[]>([]);
  const [maskBoxes, setMaskBoxes] = useState<MaskBox[]>([]);
  const [brushSize, setBrushSize] = useState(() =>
    defaultBrushSize(imageWidth, imageHeight),
  );
  const [undoStack, setUndoStack] = useState<MaskSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<MaskSnapshot[]>([]);

  const snapshot = useCallback(
    (): MaskSnapshot => ({ strokes: maskStrokes, boxes: maskBoxes }),
    [maskStrokes, maskBoxes],
  );

  const pushHistory = useCallback(() => {
    setUndoStack((prev) => [...prev, cloneSnapshot(snapshot())]);
    setRedoStack([]);
  }, [snapshot]);

  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  const undo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const nextUndo = prev.slice(0, -1);
      const previous = prev[prev.length - 1]!;
      setRedoStack((r) => [...r, cloneSnapshot(snapshot())]);
      setMaskStrokes(previous.strokes);
      setMaskBoxes(previous.boxes);
      return nextUndo;
    });
  }, [snapshot]);

  const redo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const nextRedo = prev.slice(0, -1);
      const restored = prev[prev.length - 1]!;
      setUndoStack((u) => [...u, cloneSnapshot(snapshot())]);
      setMaskStrokes(restored.strokes);
      setMaskBoxes(restored.boxes);
      return nextRedo;
    });
  }, [snapshot]);

  const clearAll = useCallback(() => {
    if (maskStrokes.length === 0 && maskBoxes.length === 0) return;
    pushHistory();
    setMaskStrokes([]);
    setMaskBoxes([]);
  }, [maskStrokes.length, maskBoxes.length, pushHistory]);

  const reset = useCallback(() => {
    setMaskStrokes([]);
    setMaskBoxes([]);
    setUndoStack([]);
    setRedoStack([]);
    setBrushSize(defaultBrushSize(imageWidth, imageHeight));
  }, [imageWidth, imageHeight]);

  const appendStrokePoint = useCallback(
    (point: MaskPoint) => {
      setMaskStrokes((prev) => [...prev, [point]]);
    },
    [],
  );

  const updateActiveStroke = useCallback((stroke: MaskStroke) => {
    setMaskStrokes((prev) => [...prev.slice(0, -1), stroke]);
  }, []);

  const appendBox = useCallback(
    (box: MaskBox) => {
      pushHistory();
      setMaskBoxes((prev) => [...prev, box]);
    },
    [pushHistory],
  );

  const replaceLastBox = useCallback((box: MaskBox) => {
    setMaskBoxes((prev) => [...prev.slice(0, -1), box]);
  }, []);

  const buildMaskSelection = useCallback(
    (
      brushRequest: { toolId: string },
      brushItem: { id: string; width: number; height: number },
    ): CanvasMaskSelection | null => {
      const points = maskStrokes.flat();
      for (const box of maskBoxes) {
        points.push(
          { x: box.x, y: box.y },
          { x: box.x + box.width, y: box.y + box.height },
        );
      }
      if (points.length === 0) return null;

      const minX = Math.max(0, Math.min(...points.map((p) => p.x)));
      const minY = Math.max(0, Math.min(...points.map((p) => p.y)));
      const maxX = Math.min(
        brushItem.width,
        Math.max(...points.map((p) => p.x)),
      );
      const maxY = Math.min(
        brushItem.height,
        Math.max(...points.map((p) => p.y)),
      );
      const bbox = {
        x: Math.round(minX),
        y: Math.round(minY),
        width: Math.max(1, Math.round(maxX - minX)),
        height: Math.max(1, Math.round(maxY - minY)),
      };

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(brushItem.width));
      canvas.height = Math.max(1, Math.round(brushItem.height));
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "white";
      ctx.fillStyle = "white";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = brushSize;

      for (const stroke of maskStrokes) {
        if (stroke.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(stroke[0].x, stroke[0].y);
        for (const pt of stroke.slice(1)) ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
      }
      for (const box of maskBoxes) {
        ctx.fillRect(box.x, box.y, box.width, box.height);
      }

      return {
        id: `${brushRequest.toolId}-${Date.now()}`,
        itemId: brushItem.id,
        toolId: brushRequest.toolId,
        mode:
          maskBoxes.length > 0 && maskStrokes.length === 0 ? "box" : "brush",
        maskDataUrl: canvas.toDataURL("image/png"),
        bbox,
        normalizedBbox: {
          x: bbox.x / brushItem.width,
          y: bbox.y / brushItem.height,
          width: bbox.width / brushItem.width,
          height: bbox.height / brushItem.height,
        },
      };
    },
    [maskStrokes, maskBoxes, brushSize],
  );

  const hasMask = maskStrokes.length > 0 || maskBoxes.length > 0;

  const brushSizeMin = useMemo(
    () => Math.max(4, Math.round(Math.min(imageWidth, imageHeight) * 0.008)),
    [imageWidth, imageHeight],
  );
  const brushSizeMax = useMemo(
    () => Math.max(brushSizeMin + 8, Math.round(Math.min(imageWidth, imageHeight) * 0.2)),
    [imageWidth, imageHeight, brushSizeMin],
  );

  return {
    maskStrokes,
    maskBoxes,
    brushSize,
    setBrushSize,
    brushSizeMin,
    brushSizeMax,
    canUndo,
    canRedo,
    undo,
    redo,
    clearAll,
    reset,
    pushHistory,
    appendStrokePoint,
    updateActiveStroke,
    appendBox,
    replaceLastBox,
    buildMaskSelection,
    hasMask,
  };
}
