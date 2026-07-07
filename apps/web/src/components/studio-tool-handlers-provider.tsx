"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { DesignCanvasProps } from "@/components/design-canvas-types";

/** 由 Studio workspace 注入、DesignCanvas 经 Context 消费的画布工具 props */
export type StudioCanvasToolProps = Pick<
  DesignCanvasProps,
  | "nodeActions"
  | "brushRequest"
  | "expandRequest"
  | "focusClickRequest"
  | "onFocusImageClick"
  | "onFocusClickCancel"
  | "onExpandCancel"
  | "onExpandComplete"
  | "onBrushCancel"
  | "onBrushComplete"
  | "selectionToolbar"
>;

const StudioToolHandlersContext = createContext<StudioCanvasToolProps | null>(
  null,
);

export function StudioToolHandlersProvider({
  value,
  children,
}: {
  value: StudioCanvasToolProps;
  children: ReactNode;
}) {
  return (
    <StudioToolHandlersContext.Provider value={value}>
      {children}
    </StudioToolHandlersContext.Provider>
  );
}

export function useStudioToolHandlersContext(): StudioCanvasToolProps {
  const ctx = useContext(StudioToolHandlersContext);
  if (!ctx) {
    throw new Error(
      "useStudioToolHandlersContext must be used within StudioToolHandlersProvider",
    );
  }
  return ctx;
}

export function useStudioToolHandlersContextOptional():
  | StudioCanvasToolProps
  | null {
  return useContext(StudioToolHandlersContext);
}
