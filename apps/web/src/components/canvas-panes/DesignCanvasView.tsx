"use client";

import { CanvasLightbox } from "@/components/canvas-lightbox";
import { ScrollCanvasPane } from "@/components/canvas-panes/ScrollCanvasPane";
import { DesignCanvasChrome } from "@/components/canvas-panes/DesignCanvasChrome";
import { CanvasPaneMenus } from "@/components/canvas-panes/CanvasPaneMenus";
import type { DesignCanvasViewModel } from "@/hooks/use-design-canvas";

export function DesignCanvasView({ vm }: { vm: DesignCanvasViewModel }) {
  const {
    mobile,
    selectSourceBanner,
    showFailureBannerDismiss,
    onDismissJobFailure,
    focusClickActive,
    focusClickRequest,
    onFocusClickCancel,
    selectedId,
    onSelect,
    onDownload,
    onCutoutItem,
    onDeleteSelected,
    scrollCanvasRef,
    productGalleryProps,
    conversationPaneActive,
    conversationPaneWidth,
    onConversationPaneResizeStart,
    conversationPaneResizing,
    scrollBottomInset,
    contextMenu,
    setContextMenu,
    lightbox,
    setLightbox,
  } = vm;

  return (
    <div
      className={`flex min-h-0 min-w-0 flex-1 overflow-hidden bg-[#0d0d0d] ${
        mobile ? "flex-col" : "flex-row"
      }`}
    >
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <DesignCanvasChrome
          selectSourceBanner={selectSourceBanner}
          showFailureBannerDismiss={showFailureBannerDismiss}
          onDismissJobFailure={onDismissJobFailure}
          focusClickActive={focusClickActive}
          focusClickRequest={focusClickRequest}
          onFocusClickCancel={onFocusClickCancel}
        />

        <ScrollCanvasPane
          scrollCanvasRef={scrollCanvasRef}
          productGalleryProps={productGalleryProps}
          conversationPaneActive={conversationPaneActive}
          conversationPaneWidth={conversationPaneWidth}
          onConversationPaneResizeStart={onConversationPaneResizeStart}
          conversationPaneResizing={conversationPaneResizing}
          scrollBottomInset={scrollBottomInset}
        />
      </div>

      <CanvasPaneMenus
        contextMenu={contextMenu}
        onCloseContextMenu={() => setContextMenu(null)}
        onSelect={onSelect}
        onDownload={onDownload}
        onDeleteSelected={onDeleteSelected}
        onCutoutItem={onCutoutItem}
      />

      {lightbox ? (
        <CanvasLightbox
          items={lightbox.items}
          initialIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      ) : null}
    </div>
  );
}
