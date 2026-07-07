"use client";

import { Bookmark, Music, Plus } from "lucide-react";

import { CanvasJobOverlay } from "@/components/canvas-job-overlay";
import { InfiniteCanvasContainer } from "@/components/infinite-canvas/InfiniteCanvasContainer";
import { InfiniteCanvasEmptyPrompt } from "@/components/infinite-canvas/InfiniteCanvasEmptyPrompt";
import { DramaPropertyPanel } from "@/components/infinite-canvas/drama/DramaPropertyPanel";
import { CanvasAssistantPanel } from "@/components/infinite-canvas/agent/CanvasAssistantPanel";
import { TemplateManager } from "@/components/infinite-canvas/TemplateManager";
import { MusicGenPanel } from "@/components/music-gen-panel";
import type { CanvasNodeMetadata, CanvasNodeData } from "@/components/infinite-canvas/types";

import type { InfiniteCanvasPaneProps } from "./canvas-pane-types";
import { InfiniteOrchestrationDock } from "./OrchestrationOverlay";

function enrichNodesWithBatchIndex(nodes: CanvasNodeData[]): CanvasNodeData[] {
  const batchOrder = new Map<string, number>();
  let next = 1;
  return nodes.map((n) => {
    const rootId = n.metadata?.batchRootId;
    if (!rootId) return n;
    let idx = batchOrder.get(rootId);
    if (idx === undefined) {
      idx = next++;
      batchOrder.set(rootId, idx);
    }
    return {
      ...n,
      metadata: { ...(n.metadata as CanvasNodeMetadata), batchIndex: idx },
    };
  });
}

export function InfiniteCanvasPane({
  areaRef,
  nodes,
  connections,
  viewport,
  selectedNodeIds,
  overlayBottomInsetPx,
  readOnly = false,
  jobOverlay,
  renderNodeStudioPanel,
  onNodesChange,
  onConnectionsChange,
  onViewportChange,
  onSelectionChange,
  onNodeDoubleClick,
  onConnectionCreateClick,
  onCanvasDoubleClick,
  onContextMenu,
  showEmptyPrompt,
  emptyCreation,
  onOpenCenterCreateMenu,
  onNodeCreateToggleClick,
  showTemplateManager,
  onToggleTemplateManager,
  showMusicGenPanel,
  onToggleMusicGenPanel,
  dramaPanelNode,
  showDramaPropertyPanel,
  onCloseDramaPanel,
  assistantSnapshot,
  showAssistantPanel,
  onApplyAssistantOps,
  templateSelectedNodes,
  templateSelectedConnections,
  sessionId,
  onTemplatePlanRunStarted,
  onCloseTemplateManager,
  onCloseMusicGenPanel,
  infiniteOrchestrationDock,
  legacyInfiniteOrchestrationDock,
  alternateCanvasContent,
  orchestrationEvent,
  orchestrationActions,
  orchestrationExtra,
}: InfiniteCanvasPaneProps) {
  return (
    <div
      ref={areaRef}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      data-testid="infinite-canvas-pane"
    >
      <div className="relative flex min-h-0 flex-1">
        <div className="relative min-h-0 flex-1">
          {jobOverlay.show || jobOverlay.failed ? (
            <CanvasJobOverlay
              status={jobOverlay.status}
              failed={jobOverlay.failed}
              errorMessage={jobOverlay.errorMessage}
              onOpenChat={jobOverlay.onOpenChat}
              onCancel={jobOverlay.onCancel}
              onDismiss={jobOverlay.failed ? jobOverlay.onDismissFailure : undefined}
              completed={jobOverlay.completed}
              total={jobOverlay.total}
              elapsedMs={jobOverlay.elapsedMs}
              queueAhead={jobOverlay.queueAhead}
            />
          ) : null}
          <InfiniteCanvasContainer
            nodes={enrichNodesWithBatchIndex(nodes)}
            connections={connections}
            viewport={viewport}
            selectedNodeIds={selectedNodeIds}
            overlayBottomInsetPx={overlayBottomInsetPx}
            renderPanel={renderNodeStudioPanel}
            onNodesChange={onNodesChange}
            onConnectionsChange={onConnectionsChange}
            onViewportChange={onViewportChange}
            onSelectionChange={onSelectionChange}
            onNodeDoubleClick={onNodeDoubleClick}
            onConnectionCreateClick={onConnectionCreateClick}
            onCanvasDoubleClick={onCanvasDoubleClick}
            onContextMenu={onContextMenu}
          />
          {showEmptyPrompt && emptyCreation ? (
            <InfiniteCanvasEmptyPrompt
              prompt={emptyCreation.prompt}
              onPromptChange={emptyCreation.onPromptChange}
              onSubmit={emptyCreation.onSubmit}
              onAddNode={readOnly ? undefined : onOpenCenterCreateMenu}
              readOnly={readOnly}
              submitting={emptyCreation.submitting}
              submitLabel={emptyCreation.submitLabel}
            />
          ) : null}
          <button
            type="button"
            onClick={(e) => onNodeCreateToggleClick(e.currentTarget.getBoundingClientRect())}
            className="absolute right-3 top-[6.25rem] z-20 inline-flex size-8 items-center justify-center rounded-md border transition bg-black/40 text-zinc-300 hover:bg-black/60"
            style={{ borderColor: "rgba(255,255,255,0.15)" }}
            aria-label="添加节点"
            title="添加节点"
            data-testid="node-create-toggle"
          >
            <Plus className="size-4" />
          </button>
          <button
            type="button"
            onClick={onToggleTemplateManager}
            className={`absolute right-3 top-3 z-20 inline-flex size-8 items-center justify-center rounded-md border transition ${
              showTemplateManager
                ? "bg-white/20 text-white"
                : "bg-black/40 text-zinc-300 hover:bg-black/60"
            }`}
            style={{ borderColor: "rgba(255,255,255,0.15)" }}
            aria-label="工作流模板"
            title="工作流模板"
            data-testid="template-manager-toggle"
          >
            <Bookmark className="size-4" />
          </button>
          <button
            type="button"
            onClick={onToggleMusicGenPanel}
            className={`absolute right-3 top-14 z-20 inline-flex size-8 items-center justify-center rounded-md border transition ${
              showMusicGenPanel
                ? "bg-white/20 text-white"
                : "bg-black/40 text-zinc-300 hover:bg-black/60"
            }`}
            style={{ borderColor: "rgba(255,255,255,0.15)" }}
            aria-label="AI 音乐生成"
            title="AI 音乐生成"
            data-testid="music-gen-toggle"
          >
            <Music className="size-4" />
          </button>
        </div>
        {dramaPanelNode && showDramaPropertyPanel ? (
          <DramaPropertyPanel
            node={dramaPanelNode}
            onClose={onCloseDramaPanel}
          />
        ) : null}
        {assistantSnapshot && showAssistantPanel ? (
          <CanvasAssistantPanel
            snapshot={assistantSnapshot}
            onApplyOps={onApplyAssistantOps}
            initialCollapsed
          />
        ) : null}
        {showTemplateManager ? (
          <TemplateManager
            selectedNodes={templateSelectedNodes}
            connections={templateSelectedConnections}
            sessionId={sessionId}
            onRunStarted={onTemplatePlanRunStarted}
            onClose={onCloseTemplateManager}
          />
        ) : null}
        {showMusicGenPanel ? (
          <MusicGenPanel
            variant="sidebar"
            sessionId={sessionId}
            onClose={onCloseMusicGenPanel}
          />
        ) : null}
      </div>
      <InfiniteOrchestrationDock
        infiniteOrchestrationDock={infiniteOrchestrationDock}
        legacyInfiniteOrchestrationDock={legacyInfiniteOrchestrationDock}
        alternateCanvasContent={alternateCanvasContent}
        orchestrationEvent={orchestrationEvent}
        orchestrationActions={orchestrationActions}
        orchestrationExtra={orchestrationExtra}
      />
    </div>
  );
}
