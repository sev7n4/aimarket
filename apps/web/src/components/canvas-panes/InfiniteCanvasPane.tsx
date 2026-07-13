"use client";

import { Bookmark, Music, Plus } from "lucide-react";
import { cn } from "@aimarket/ui";

import { CanvasJobOverlay } from "@/components/canvas-job-overlay";
import { InfiniteCanvasContainer } from "@/components/infinite-canvas/InfiniteCanvasContainer";
import { InfiniteCanvasEmptyPrompt } from "@/components/infinite-canvas/InfiniteCanvasEmptyPrompt";
import { DramaPropertyPanel } from "@/components/infinite-canvas/drama/DramaPropertyPanel";
import { CanvasAssistantPanel } from "@/components/infinite-canvas/agent/CanvasAssistantPanel";
import { TemplateManager } from "@/components/infinite-canvas/TemplateManager";
import { WorkflowShareButton } from "@/components/workflows/WorkflowShareButton";
import { MusicGenPanel } from "@/components/music-gen-panel";
import { WorkflowToolPalette } from "@/components/workflows/WorkflowToolPalette";
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
  workflowShell = false,
  onAddWorkflowTool,
  agentPanelWidth = 520,
  agentPanelDragging = false,
  onAgentPanelResizeStart,
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
      <div
        className={cn(
          "relative flex min-h-0 flex-1",
          workflowShell ? "flex-row" : "",
        )}
      >
        <div className="relative min-h-0 flex-1 flex min-w-0">
          {workflowShell && onAddWorkflowTool ? (
            <WorkflowToolPalette
              onAddTool={onAddWorkflowTool}
              readOnly={readOnly}
            />
          ) : null}
          <div className="relative min-h-0 min-w-0 flex-1">
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
            workflowShell={workflowShell}
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
          {workflowShell ? <WorkflowShareButton sessionId={sessionId} /> : null}
        </div>
        </div>
        {dramaPanelNode && showDramaPropertyPanel ? (
          <DramaPropertyPanel
            node={dramaPanelNode}
            onClose={onCloseDramaPanel}
          />
        ) : null}
        {workflowShell && assistantSnapshot && showAssistantPanel && onAgentPanelResizeStart ? (
          <button
            type="button"
            aria-label="拖拽调整 Agent 面板宽度"
            onMouseDown={onAgentPanelResizeStart}
            className={cn(
              "z-30 hidden w-1 shrink-0 cursor-col-resize transition-colors hover:bg-indigo-500/40 lg:block",
              agentPanelDragging ? "bg-indigo-500/60" : "bg-white/5",
            )}
            data-testid="workflow-agent-resize-handle"
          />
        ) : null}
        {assistantSnapshot && showAssistantPanel ? (
          <CanvasAssistantPanel
            snapshot={assistantSnapshot}
            onApplyOps={onApplyAssistantOps}
            initialCollapsed={!workflowShell}
            variant={workflowShell ? "docked" : "floating"}
            width={workflowShell ? agentPanelWidth : undefined}
            confirmTools={workflowShell}
            workflowShell={workflowShell}
            sessionId={sessionId}
          />
        ) : null}
        {showTemplateManager ? (
          <TemplateManager
            selectedNodes={templateSelectedNodes}
            connections={templateSelectedConnections}
            sessionId={sessionId}
            variant={workflowShell ? "workflow" : "drama"}
            onRunStarted={onTemplatePlanRunStarted}
            onApplyTemplate={
              workflowShell
                ? (ops) => {
                    onApplyAssistantOps(ops);
                  }
                : undefined
            }
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
