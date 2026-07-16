import type { RefObject } from "react";
import type { CanvasItem } from "@/lib/canvas-tools";
import type {
  OrchestrationTimelineActions,
  OrchestrationTimelineEvent,
} from "@/lib/canvas-timeline";

/** Scroll / Pane 共享基础 props */
export type CanvasPaneBaseProps = {
  readOnly?: boolean;
  items: CanvasItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

/** Scroll 画布 Pane — 见 ScrollCanvasPane.tsx */
export type { ScrollCanvasPaneProps } from "./ScrollCanvasPane";

export type ScrollOrchestrationProps = {
  orchestrationEvent?: OrchestrationTimelineEvent | null;
  orchestrationActions?: OrchestrationTimelineActions;
  orchestrationExtra?: React.ReactNode;
};

export type ScrollCanvasPaneRef = RefObject<unknown>;
