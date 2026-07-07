"use client";

import { forwardRef } from "react";

import { DesignCanvasView } from "@/components/canvas-panes/DesignCanvasView";
import { useDesignCanvas } from "@/hooks/use-design-canvas";
import type { DesignCanvasHandle, DesignCanvasProps } from "@/components/design-canvas-types";

export type { DesignCanvasHandle, DesignCanvasProps } from "@/components/design-canvas-types";

export const DesignCanvas = forwardRef<DesignCanvasHandle, DesignCanvasProps>(
  function DesignCanvas(props, ref) {
    const vm = useDesignCanvas(props, ref);
    return <DesignCanvasView vm={vm} />;
  },
);
