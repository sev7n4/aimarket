"use client";

import { useRef, useState } from "react";

const DOCK_UPLOAD_IMAGE_TYPES = /^image\/(jpeg|png|webp)$/i;

function imageFilesFromDataTransfer(dt: DataTransfer): File[] {
  return Array.from(dt.files ?? []).filter((f) =>
    DOCK_UPLOAD_IMAGE_TYPES.test(f.type),
  );
}

function dataTransferHasFiles(dt: DataTransfer): boolean {
  return dt.types.includes("Files") || dt.files.length > 0;
}

export function useCreationDockDrag(input: {
  enabled: boolean;
  readOnly: boolean;
  onDropFiles: (files: File[]) => void;
  onInvalidDrop?: () => void;
}) {
  const { enabled, readOnly, onDropFiles, onInvalidDrop } = input;
  const [dockDragOver, setDockDragOver] = useState(false);
  const dockDragDepthRef = useRef(0);

  function handleDockDragEnter(e: React.DragEvent) {
    if (!enabled || readOnly) return;
    if (!dataTransferHasFiles(e.dataTransfer)) return;
    e.preventDefault();
    dockDragDepthRef.current += 1;
    setDockDragOver(true);
  }

  function handleDockDragLeave(e: React.DragEvent) {
    if (!enabled || readOnly) return;
    e.preventDefault();
    dockDragDepthRef.current = Math.max(0, dockDragDepthRef.current - 1);
    if (dockDragDepthRef.current === 0) setDockDragOver(false);
  }

  function handleDockDragOver(e: React.DragEvent) {
    if (!enabled || readOnly) return;
    if (!dataTransferHasFiles(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }

  function handleDockDrop(e: React.DragEvent) {
    if (!enabled || readOnly) return;
    e.preventDefault();
    dockDragDepthRef.current = 0;
    setDockDragOver(false);
    const files = imageFilesFromDataTransfer(e.dataTransfer);
    if (!files.length) {
      onInvalidDrop?.();
      return;
    }
    onDropFiles(files);
  }

  return {
    dockDragOver,
    handleDockDragEnter,
    handleDockDragLeave,
    handleDockDragOver,
    handleDockDrop,
  };
}
