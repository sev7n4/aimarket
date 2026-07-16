"use client";

import { forwardRef } from "react";

import { DesignCanvasView } from "@/components/canvas-panes/DesignCanvasView";
import { useStudioToolHandlersContextOptional } from "@/components/studio-tool-handlers-provider";
import { useDesignCanvas } from "@/hooks/use-design-canvas";
import type { DesignCanvasHandle, DesignCanvasProps } from "@/components/design-canvas-types";

export type { DesignCanvasHandle, DesignCanvasProps } from "@/components/design-canvas-types";

export const DesignCanvas = forwardRef<DesignCanvasHandle, DesignCanvasProps>(
  function DesignCanvas(props, ref) {
    const toolHandlers = useStudioToolHandlersContextOptional();
    const vm = useDesignCanvas({ ...toolHandlers, ...props }, ref);
    return <DesignCanvasView vm={vm} />;
  },
);
