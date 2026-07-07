"use client";

import type { ReactNode } from "react";
import { GlassPanel } from "@aimarket/ui";

import { CanvasLightbox } from "@/components/canvas-lightbox";
import { HomeGenerationPreview } from "@/components/home-generation-preview";
import { StudioDockFocusButton } from "@/components/studio-dock-controls";
import type { UploadPreviewItem } from "@/components/upload-preview-stack";
import type { StudioDockMode } from "@/lib/studio-dock-state";

export type CreationPanelViewProps = {
  isDock: boolean;
  compact?: boolean;
  navigating: boolean;
  uploadPreviewIndex: number | null;
  uploadPreviews: UploadPreviewItem[];
  onUploadPreviewClose: () => void;
  onDockModeChange?: (mode: StudioDockMode) => void;
  dockDragOver: boolean;
  onDockDragEnter: (e: React.DragEvent) => void;
  onDockDragLeave: (e: React.DragEvent) => void;
  onDockDragOver: (e: React.DragEvent) => void;
  onDockDrop: (e: React.DragEvent) => void;
  children: ReactNode;
};

function CreationPanelOverlays({
  navigating,
  uploadPreviewIndex,
  uploadPreviews,
  onUploadPreviewClose,
}: Pick<
  CreationPanelViewProps,
  "navigating" | "uploadPreviewIndex" | "uploadPreviews" | "onUploadPreviewClose"
>) {
  return (
    <>
      <HomeGenerationPreview open={navigating} />
      {uploadPreviewIndex != null && uploadPreviews.length > 0 ? (
        <CanvasLightbox
          items={uploadPreviews.map((item, i) => ({
            id: item.id,
            url: item.url,
            label: `上传图 ${i + 1}`,
          }))}
          initialIndex={Math.min(uploadPreviewIndex, uploadPreviews.length - 1)}
          onClose={onUploadPreviewClose}
        />
      ) : null}
    </>
  );
}

export function CreationPanelView({
  isDock,
  compact,
  navigating,
  uploadPreviewIndex,
  uploadPreviews,
  onUploadPreviewClose,
  onDockModeChange,
  dockDragOver,
  onDockDragEnter,
  onDockDragLeave,
  onDockDragOver,
  onDockDrop,
  children,
}: CreationPanelViewProps) {
  const overlays = (
    <CreationPanelOverlays
      navigating={navigating}
      uploadPreviewIndex={uploadPreviewIndex}
      uploadPreviews={uploadPreviews}
      onUploadPreviewClose={onUploadPreviewClose}
    />
  );

  if (isDock) {
    return (
      <>
        {overlays}
        <div
          data-testid="creation-dock-drop-zone"
          data-drag-active={dockDragOver ? "true" : undefined}
          onDragEnter={onDockDragEnter}
          onDragLeave={onDockDragLeave}
          onDragOver={onDockDragOver}
          onDrop={onDockDrop}
          className={`relative w-full overflow-visible rounded-[1.5rem] border bg-gradient-to-b from-white/[0.07] via-zinc-950/76 to-zinc-950/92 shadow-[0_12px_48px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.05)_inset,0_-18px_42px_rgba(249,115,22,0.06),0_12px_48px_rgba(139,92,246,0.05)] backdrop-blur-2xl backdrop-saturate-150 transition ${
            dockDragOver
              ? "border-orange-400/50 ring-2 ring-orange-500/35"
              : "border-white/[0.12]"
          }`}
        >
          <div
            className="pointer-events-none absolute -left-10 top-0 h-28 w-28 rounded-full bg-orange-500/[0.08] blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -right-8 top-2 h-24 w-24 rounded-full bg-violet-500/[0.08] blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
            aria-hidden
          />
          {onDockModeChange ? (
            <StudioDockFocusButton onModeChange={onDockModeChange} />
          ) : null}
          {children}
        </div>
      </>
    );
  }

  return (
    <>
      {overlays}
      <GlassPanel
        className={`mx-auto w-full max-w-3xl p-4 sm:p-5 ${compact ? "" : "shadow-orange-500/5"}`}
      >
        {children}
      </GlassPanel>
    </>
  );
}
