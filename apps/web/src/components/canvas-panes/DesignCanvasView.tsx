"use client";

import { CanvasToolbar } from "@/components/canvas-toolbar";
import { CanvasLightbox } from "@/components/canvas-lightbox";
import { InfiniteCanvasPane } from "@/components/canvas-panes/InfiniteCanvasPane";
import { ScrollCanvasPane } from "@/components/canvas-panes/ScrollCanvasPane";
import { FreeCanvasPane } from "@/components/canvas-panes/FreeCanvasPane";
import { ScrollAlternateOrchestrationPane } from "@/components/canvas-panes/OrchestrationOverlay";
import { DesignCanvasChrome } from "@/components/canvas-panes/DesignCanvasChrome";
import { CanvasPaneMenus } from "@/components/canvas-panes/CanvasPaneMenus";
import { InfiniteCanvasToolPanels } from "@/components/canvas-panes/InfiniteCanvasToolPanels";
import { resolveNodeImageUrl } from "@/lib/infinite-node-tool-run";
import { applyNodePositionsToItems } from "@/components/infinite-canvas/migration";
import { extractPersistedConnections, isDramaNodeId } from "@/components/infinite-canvas/sync-infinite-snapshot";
import type { CanvasNodeData } from "@/components/infinite-canvas/types";
import type { ContextMenuState } from "@/components/infinite-canvas/types";
import type { DesignCanvasViewModel } from "@/hooks/use-design-canvas";

export function DesignCanvasView({ vm }: { vm: DesignCanvasViewModel }) {
  const {
    mobile,
    showFreeCanvas,
    tool,
    gridOn,
    handleTool,
    canUndo,
    canRedo,
    selectSourceBanner,
    showFailureBannerDismiss,
    onDismissJobFailure,
    isRefineMode,
    exitRefineMode,
    refineCompleteNotice,
    compareAvailable,
    compareMode,
    setCompareMode,
    canvasViewEnabled,
    dramaViewPhase,
    onDramaViewPhaseChange,
    focusClickActive,
    focusClickRequest,
    onFocusClickCancel,
    useInfiniteCanvas,
    items,
    selectedId,
    onSelect,
    readOnly,
    infiniteCanvasAreaRef,
    allCanvasNodes,
    canvasConnections,
    infiniteViewport,
    setInfiniteViewport,
    infiniteSelectedIds,
    overlayBottomInsetPx,
    showInfiniteJobOverlay,
    jobFailed,
    jobStreamStatus,
    jobErrorMessage,
    jobProgressCompleted,
    jobProgressTotal,
    jobElapsedMs,
    queueAhead,
    onOpenChatPanel,
    onCancelJob,
    renderInfiniteNodeStudioPanel,
    applyingAssistantOpsRef,
    onItemsChange,
    dramaNodePositions,
    onDramaNodePositionsChange,
    onInfiniteConnectionsChange,
    handleInfiniteSelectionChange,
    setDramaPanelNodeId,
    setConnectionCreateMenu,
    setInfiniteContextMenu,
    setConnectionContextMenu,
    setPaneCreateMenu,
    allCanvasNodesRef,
    showInfiniteEmptyPrompt,
    infiniteEmptyCreation,
    openInfiniteCenterCreateMenu,
    handleNodeCreateToggleClick,
    showTemplateManager,
    setShowTemplateManager,
    showMusicGenPanel,
    setShowMusicGenPanel,
    dramaPanelNode,
    isDramaWorkflowInfiniteView,
    effectiveAssistantSnapshot,
    handleApplyAssistantOps,
    workflowShell,
    agentPanelWidth,
    agentPanelDragging,
    onAgentPanelResizeStart,
    templateSelectedNodes,
    templateSelectedConnections,
    sessionId,
    onTemplatePlanRunStarted,
    infiniteOrchestrationDock,
    legacyInfiniteOrchestrationDock,
    alternateCanvasContent,
    orchestrationEvent,
    orchestrationActions,
    orchestrationExtra,
    scrollBottomInset,
    freeCanvasRef,
    batchSections,
    handleItemsChangeWithHistory,
    emptyHint,
    pulseId,
    refineItemId,
    refineRootItemId,
    refineChain,
    selectRefineTarget,
    comparePair,
    setLightbox,
    setContextMenu,
    onJumpToParentBatch,
    onDeleteSelected,
    onRerun,
    setTool,
    brushRequest,
    onBrushComplete,
    onBrushCancel,
    expandRequest,
    onExpandComplete,
    onExpandCancel,
    onFocusImageClick,
    selectionToolbar,
    statusChip,
    scrollCanvasRef,
    productGalleryProps,
    conversationPaneActive,
    conversationPaneWidth,
    onConversationPaneResizeStart,
    conversationPaneResizing,
    contextMenu,
    onDownload,
    onCutoutItem,
    onExpandItem,
    infiniteContextMenu,
    getInfiniteNodeMenuHandlers,
    paneCreateMenu,
    allowDramaNodeCreate,
    handleCreateNodeAt,
    connectionCreateMenu,
    handleCreateDownstreamNode,
    connectionContextMenu,
    handleDeleteConnection,
    showVideoInpaint,
    setShowVideoInpaint,
    videoInpaintSubmitting,
    onRunInfiniteNodeTool,
    contextMenuForItem,
    showLighting,
    setShowLighting,
    runInfiniteNodeTool,
    showCamera,
    setShowCamera,
    onPatchDramaShotNode,
    lightbox,
    enterRefineMode,
    setVideoInpaintSubmitting,
  } = vm;
  return (
      <div
        className={`flex min-h-0 min-w-0 flex-1 overflow-hidden bg-[#0d0d0d] ${
          mobile ? "flex-col" : "flex-row"
        }`}
      >
        {!mobile && showFreeCanvas ? (
          <CanvasToolbar
            active={tool}
            gridOn={gridOn}
            onTool={handleTool}
            layoutMode="free"
            canUndo={canUndo}
            canRedo={canRedo}
          />
        ) : null}

        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <DesignCanvasChrome
            selectSourceBanner={selectSourceBanner}
            showFailureBannerDismiss={showFailureBannerDismiss}
            onDismissJobFailure={onDismissJobFailure}
            isRefineMode={isRefineMode}
            onExitRefineMode={exitRefineMode}
            refineCompleteNotice={refineCompleteNotice}
            compareAvailable={compareAvailable}
            compareMode={compareMode}
            onToggleCompareMode={() => setCompareMode((v) => !v)}
            canvasViewEnabled={canvasViewEnabled}
            dramaViewPhase={dramaViewPhase}
            onDramaViewPhaseChange={onDramaViewPhaseChange}
            focusClickActive={focusClickActive}
            focusClickRequest={focusClickRequest}
            onFocusClickCancel={onFocusClickCancel}
          />

          {useInfiniteCanvas ? (
            <InfiniteCanvasPane
              items={items}
              selectedId={selectedId}
              onSelect={onSelect}
              readOnly={readOnly}
              areaRef={infiniteCanvasAreaRef}
              nodes={allCanvasNodes}
              connections={canvasConnections}
              viewport={infiniteViewport}
              selectedNodeIds={infiniteSelectedIds}
              overlayBottomInsetPx={overlayBottomInsetPx}
              jobOverlay={{
                show: showInfiniteJobOverlay,
                failed: jobFailed,
                status: jobStreamStatus ?? null,
                errorMessage: jobErrorMessage,
                completed: jobProgressCompleted,
                total: jobProgressTotal,
                elapsedMs: jobElapsedMs,
                queueAhead,
                onOpenChat: onOpenChatPanel,
                onCancel: onCancelJob,
                onDismissFailure: onDismissJobFailure,
              }}
              renderNodeStudioPanel={renderInfiniteNodeStudioPanel}
              onNodesChange={(nodes: CanvasNodeData[]) => {
                if (applyingAssistantOpsRef.current) return;
                const itemNodes = nodes.filter((n) => !isDramaNodeId(n.id));
                onItemsChange(applyNodePositionsToItems(items, itemNodes));
                if (onDramaNodePositionsChange) {
                  const next = { ...dramaNodePositions };
                  let changed = false;
                  for (const node of nodes) {
                    if (!isDramaNodeId(node.id)) continue;
                    const prev = dramaNodePositions[node.id];
                    if (
                      !prev ||
                      prev.x !== node.position.x ||
                      prev.y !== node.position.y
                    ) {
                      next[node.id] = {
                        x: node.position.x,
                        y: node.position.y,
                      };
                      changed = true;
                    }
                  }
                  if (changed) onDramaNodePositionsChange(next);
                }
              }}
              onConnectionsChange={(nextConnections) => {
                if (applyingAssistantOpsRef.current || readOnly) return;
                onInfiniteConnectionsChange?.(
                  extractPersistedConnections(nextConnections, items),
                );
              }}
              onViewportChange={setInfiniteViewport}
              onSelectionChange={handleInfiniteSelectionChange}
              onNodeDoubleClick={(nodeId) => {
                onSelect(nodeId);
                setDramaPanelNodeId(nodeId);
              }}
              onConnectionCreateClick={(event, nodeId) => {
                if (readOnly) return;
                setConnectionCreateMenu({
                  sourceNodeId: nodeId,
                  x: event.clientX,
                  y: event.clientY,
                });
              }}
              onCanvasDoubleClick={(world, client) => {
                if (readOnly) return;
                setInfiniteContextMenu(null);
                setConnectionContextMenu(null);
                setConnectionCreateMenu(null);
                setPaneCreateMenu({
                  x: client.x,
                  y: client.y,
                  worldX: world.x,
                  worldY: world.y,
                });
              }}
              onContextMenu={(state: ContextMenuState | null) => {
                if (state?.type === "node") {
                  setPaneCreateMenu(null);
                  const target = allCanvasNodesRef.current.find(
                    (n) => n.id === state.nodeId,
                  );
                  if (target) {
                    setInfiniteContextMenu({
                      node: target,
                      x: state.x,
                      y: state.y,
                    });
                  }
                } else if (state?.type === "pane") {
                  if (readOnly) return;
                  setInfiniteContextMenu(null);
                  setConnectionContextMenu(null);
                  setPaneCreateMenu({
                    x: state.x,
                    y: state.y,
                    worldX: state.worldX,
                    worldY: state.worldY,
                  });
                } else if (state?.type === "connection") {
                  if (readOnly) return;
                  setInfiniteContextMenu(null);
                  setPaneCreateMenu(null);
                  setConnectionContextMenu({
                    connectionId: state.connectionId,
                    x: state.x,
                    y: state.y,
                  });
                } else {
                  setInfiniteContextMenu(null);
                  setPaneCreateMenu(null);
                  setConnectionContextMenu(null);
                }
              }}
              showEmptyPrompt={showInfiniteEmptyPrompt}
              emptyCreation={infiniteEmptyCreation}
              onOpenCenterCreateMenu={openInfiniteCenterCreateMenu}
              onNodeCreateToggleClick={handleNodeCreateToggleClick}
              showTemplateManager={showTemplateManager}
              onToggleTemplateManager={() =>
                setShowTemplateManager((v) => !v)
              }
              showMusicGenPanel={showMusicGenPanel}
              onToggleMusicGenPanel={() => setShowMusicGenPanel((v) => !v)}
              dramaPanelNode={dramaPanelNode}
              showDramaPropertyPanel={!isDramaWorkflowInfiniteView}
              onCloseDramaPanel={() => setDramaPanelNodeId(null)}
              assistantSnapshot={effectiveAssistantSnapshot}
              showAssistantPanel={workflowShell || !isDramaWorkflowInfiniteView}
              onApplyAssistantOps={handleApplyAssistantOps}
              workflowShell={workflowShell}
              agentPanelWidth={agentPanelWidth}
              agentPanelDragging={agentPanelDragging}
              onAgentPanelResizeStart={onAgentPanelResizeStart}
              templateSelectedNodes={templateSelectedNodes}
              templateSelectedConnections={templateSelectedConnections}
              sessionId={sessionId}
              onTemplatePlanRunStarted={onTemplatePlanRunStarted}
              onCloseTemplateManager={() => setShowTemplateManager(false)}
              onCloseMusicGenPanel={() => setShowMusicGenPanel(false)}
              infiniteOrchestrationDock={infiniteOrchestrationDock}
              legacyInfiniteOrchestrationDock={legacyInfiniteOrchestrationDock}
              alternateCanvasContent={alternateCanvasContent}
              orchestrationEvent={orchestrationEvent}
              orchestrationActions={orchestrationActions}
              orchestrationExtra={orchestrationExtra}
            />
          ) : alternateCanvasContent ? (
            <ScrollAlternateOrchestrationPane
              alternateCanvasContent={alternateCanvasContent}
              orchestrationExtra={orchestrationExtra}
              scrollBottomInset={scrollBottomInset}
            />
          ) : showFreeCanvas ? (
            <FreeCanvasPane
              freeCanvasRef={freeCanvasRef}
              items={items}
              batchSections={batchSections}
              selectedId={selectedId}
              onSelect={onSelect}
              onItemsChangeWithHistory={handleItemsChangeWithHistory}
              readOnly={readOnly}
              emptyHint={emptyHint}
              pulseId={pulseId}
              isRefineMode
              refineItemId={refineItemId}
              refineRootItemId={refineRootItemId}
              refineChain={refineChain}
              onRefineTargetSelect={selectRefineTarget}
              compareMode={compareMode}
              comparePair={comparePair}
              onCompareModeChange={setCompareMode}
              onExitRefineMode={exitRefineMode}
              onSetLightbox={setLightbox}
              onSetContextMenu={setContextMenu}
              onJumpToParentBatch={onJumpToParentBatch}
              onDeleteSelected={onDeleteSelected}
              onRerun={(item) => onRerun?.(item)}
              tool={tool}
              onToolChange={setTool}
              gridOn={gridOn}
              brushRequest={brushRequest}
              onBrushComplete={onBrushComplete}
              onBrushCancel={onBrushCancel}
              expandRequest={expandRequest}
              onExpandComplete={onExpandComplete}
              onExpandCancel={onExpandCancel}
              focusClickRequest={focusClickRequest}
              onFocusImageClick={onFocusImageClick}
              onFocusClickCancel={onFocusClickCancel}
              selectionToolbar={selectionToolbar}
              statusChip={statusChip}
              jobStreamStatus={jobStreamStatus}
              jobFailed={jobFailed}
              jobErrorMessage={jobErrorMessage}
              jobProgressCompleted={jobProgressCompleted}
              jobProgressTotal={jobProgressTotal}
              onOpenChatPanel={onOpenChatPanel}
              onCancelJob={onCancelJob}
              onDismissJobFailure={onDismissJobFailure}
              jobElapsedMs={jobElapsedMs}
              queueAhead={queueAhead}
              mobile={mobile}
            />
          ) : (
            <ScrollCanvasPane
              scrollCanvasRef={scrollCanvasRef}
              productGalleryProps={productGalleryProps}
              conversationPaneActive={conversationPaneActive}
              conversationPaneWidth={conversationPaneWidth}
              onConversationPaneResizeStart={onConversationPaneResizeStart}
              conversationPaneResizing={conversationPaneResizing}
              scrollBottomInset={scrollBottomInset}
              orchestrationEvent={orchestrationEvent}
              orchestrationActions={orchestrationActions}
              orchestrationExtra={orchestrationExtra}
            />
          )}

        </div>

        <CanvasPaneMenus
          contextMenu={contextMenu}
          onCloseContextMenu={() => setContextMenu(null)}
          onSelect={onSelect}
          onDownload={onDownload}
          onDeleteSelected={onDeleteSelected}
          onCutoutItem={onCutoutItem}
          onExpandItem={onExpandItem}
          infiniteContextMenu={infiniteContextMenu}
          onCloseInfiniteContextMenu={() => setInfiniteContextMenu(null)}
          getInfiniteNodeMenuHandlers={getInfiniteNodeMenuHandlers}
          paneCreateMenu={paneCreateMenu}
          onClosePaneCreateMenu={() => setPaneCreateMenu(null)}
          allowDramaNodeCreate={allowDramaNodeCreate}
          onCreateNodeAt={handleCreateNodeAt}
          connectionCreateMenu={connectionCreateMenu}
          onCloseConnectionCreateMenu={() => setConnectionCreateMenu(null)}
          onCreateDownstreamNode={handleCreateDownstreamNode}
          connectionContextMenu={connectionContextMenu}
          onCloseConnectionContextMenu={() => setConnectionContextMenu(null)}
          onDeleteConnection={handleDeleteConnection}
        />

        <InfiniteCanvasToolPanels
          showVideoInpaint={showVideoInpaint}
          onCloseVideoInpaint={() => setShowVideoInpaint(null)}
          videoInpaintSubmitting={videoInpaintSubmitting}
          onVideoInpaintSubmit={(payload) => {
            if (!onRunInfiniteNodeTool || !showVideoInpaint) return;
            setVideoInpaintSubmitting(true);
            onRunInfiniteNodeTool({
              toolId: "video-inpaint",
              node: showVideoInpaint.node,
              prompt: payload.prompt,
              toolContext: {
                toolId: "video-inpaint",
                timestampSec: payload.timestampSec ?? 0,
                masks: [
                  {
                    itemId: showVideoInpaint.node.id,
                    mode: "brush",
                    maskDataUrl: payload.maskDataUrl,
                    bbox: payload.maskBbox,
                    normalizedBbox: payload.maskNormalizedBbox,
                  },
                ],
              },
            });
            setVideoInpaintSubmitting(false);
            setShowVideoInpaint(null);
          }}
          resolveVideoUrl={(node) =>
            contextMenuForItem(node)?.url ??
            node.metadata?.content ??
            undefined
          }
          showLighting={showLighting}
          onCloseLighting={() => setShowLighting(null)}
          onApplyLighting={(sources) => {
            if (!showLighting) return;
            runInfiniteNodeTool("lighting-control", showLighting.node, {
              toolContext: { toolId: "lighting-control", sources },
            });
            setShowLighting(null);
          }}
          showCamera={showCamera}
          onCloseCamera={() => setShowCamera(null)}
          onApplyCamera={(params) => {
            if (!showCamera) return;
            const hasImage = Boolean(resolveNodeImageUrl(showCamera.node));
            if (hasImage) {
              runInfiniteNodeTool("camera-control", showCamera.node, {
                toolContext: { toolId: "camera-control", camera: params },
              });
            } else {
              onPatchDramaShotNode?.(showCamera.node.id, {
                cameraShotSize: params.shotSize,
                cameraMovement: params.movement,
              });
            }
            setShowCamera(null);
          }}
        />

        {lightbox && (
          <CanvasLightbox
            items={lightbox.items}
            initialIndex={lightbox.index}
            onClose={() => setLightbox(null)}
            onRefine={
              !readOnly
                ? () => {
                    const item = lightbox.items[lightbox.index];
                    if (!item || item.isVideo) return;
                    setLightbox(null);
                    enterRefineMode(item.id);
                  }
                : undefined
            }
          />
        )}
      </div>
  );
}
