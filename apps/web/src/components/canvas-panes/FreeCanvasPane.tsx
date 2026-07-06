"use client";

import type { RefObject, ComponentProps } from "react";

import { FreeCanvas } from "@/components/free-canvas";
import type { FreeCanvasHandle } from "@/components/free-canvas";

export type FreeCanvasPaneProps = ComponentProps<typeof FreeCanvas> & {
  freeCanvasRef: RefObject<FreeCanvasHandle | null>;
};

export function FreeCanvasPane({ freeCanvasRef, ...freeCanvasProps }: FreeCanvasPaneProps) {
  return <FreeCanvas ref={freeCanvasRef} {...freeCanvasProps} />;
}
