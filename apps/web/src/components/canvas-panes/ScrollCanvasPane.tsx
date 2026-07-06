"use client";

import type { RefObject, ReactNode, ComponentProps } from "react";

import { ProductGallery } from "@/components/product-gallery";
import type { ProductGalleryHandle } from "@/components/product-gallery";
import type {
  OrchestrationTimelineActions,
  OrchestrationTimelineEvent,
} from "@/lib/canvas-timeline";

import {
  ConversationOrchestrationPane,
  GalleryOrchestrationFooter,
} from "./OrchestrationOverlay";

type ProductGalleryProps = ComponentProps<typeof ProductGallery>;

export type ScrollCanvasPaneProps = {
  scrollCanvasRef: RefObject<ProductGalleryHandle | null>;
  productGalleryProps: Omit<ProductGalleryProps, "ref" | "footerSlot" | "scrollBottomInset">;
  conversationPaneActive: boolean;
  conversationPaneWidth?: number;
  onConversationPaneResizeStart?: (event: React.MouseEvent) => void;
  conversationPaneResizing?: boolean;
  scrollBottomInset: string;
  orchestrationEvent?: OrchestrationTimelineEvent | null;
  orchestrationActions?: OrchestrationTimelineActions;
  orchestrationExtra?: ReactNode;
};

export function ScrollCanvasPane({
  scrollCanvasRef,
  productGalleryProps,
  conversationPaneActive,
  conversationPaneWidth,
  onConversationPaneResizeStart,
  conversationPaneResizing = false,
  scrollBottomInset,
  orchestrationEvent,
  orchestrationActions,
  orchestrationExtra,
}: ScrollCanvasPaneProps) {
  if (conversationPaneActive) {
    return (
      <div className="flex min-h-0 flex-1 flex-row" data-testid="studio-two-pane">
        <ConversationOrchestrationPane
          orchestrationEvent={orchestrationEvent ?? null}
          orchestrationActions={orchestrationActions}
          orchestrationExtra={orchestrationExtra}
          scrollBottomInset={scrollBottomInset}
          width={conversationPaneWidth}
        />
        <div
          onMouseDown={onConversationPaneResizeStart}
          className={`hidden w-1 shrink-0 cursor-col-resize items-stretch transition-colors hover:bg-orange-500/30 lg:flex ${
            conversationPaneResizing ? "bg-orange-500/50" : "bg-transparent"
          }`}
          data-testid="conversation-pane-resizer"
          title="拖拽调整对话栏宽度"
          aria-label="拖拽调整对话栏宽度"
        />
        <ProductGallery
          ref={scrollCanvasRef}
          {...productGalleryProps}
          scrollBottomInset="pb-6"
        />
      </div>
    );
  }

  return (
    <ProductGallery
      ref={scrollCanvasRef}
      {...productGalleryProps}
      footerSlot={
        <GalleryOrchestrationFooter
          orchestrationEvent={orchestrationEvent ?? null}
          orchestrationActions={orchestrationActions}
          orchestrationExtra={orchestrationExtra}
        />
      }
    />
  );
}
