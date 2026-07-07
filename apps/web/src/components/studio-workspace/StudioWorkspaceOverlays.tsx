"use client";

import { LoginDialog } from "@/components/login-dialog";
import { ContentReportDialog } from "@/components/content-report-dialog";
import {
  ToolConfirmDialog,
  type ToolConfirmOptions,
} from "@/components/tool-confirm-dialog";
import { GridSplitPanel } from "@/components/grid-split-panel";
import {
  ToolGridResultPanel,
  type ToolGridResultState,
} from "@/components/tool-grid-result-panel";
import type { StudioTool } from "@/lib/types";
import type { CanvasItem } from "@/lib/canvas-tools";

export interface StudioWorkspaceOverlaysProps {
  user: { id: string } | null;
  sessionId: string;
  pollingJobId: string | null;
  reportOpen: boolean;
  onReportClose: () => void;
  loginOpen: boolean;
  onLoginClose: () => void;
  toolConfirm: { tool: StudioTool; item: CanvasItem } | null;
  toolConfirmPending: boolean;
  onToolConfirmClose: () => void;
  onConfirmTool: (opts: ToolConfirmOptions) => void;
  toolGridResult: ToolGridResultState | null;
  onToolGridResultClose: () => void;
}

export function StudioWorkspaceOverlays({
  user,
  sessionId,
  pollingJobId,
  reportOpen,
  onReportClose,
  loginOpen,
  onLoginClose,
  toolConfirm,
  toolConfirmPending,
  onToolConfirmClose,
  onConfirmTool,
  toolGridResult,
  onToolGridResultClose,
}: StudioWorkspaceOverlaysProps) {
  return (
    <>
      {user ? (
        <ContentReportDialog
          sessionId={sessionId}
          jobId={pollingJobId}
          open={reportOpen}
          onClose={onReportClose}
        />
      ) : null}
      <ToolConfirmDialog
        key={
          toolConfirm
            ? `${toolConfirm.tool.id}-${toolConfirm.item.id}`
            : "closed"
        }
        request={toolConfirm?.tool.id === "grid-split" ? null : toolConfirm}
        pending={toolConfirmPending}
        onClose={onToolConfirmClose}
        onConfirm={(opts) => void onConfirmTool(opts)}
      />
      {toolConfirm?.tool.id === "grid-split" ? (
        <GridSplitPanel
          key={`${toolConfirm.tool.id}-${toolConfirm.item.id}`}
          tool={toolConfirm.tool}
          item={toolConfirm.item}
          pending={toolConfirmPending}
          onClose={onToolConfirmClose}
          onConfirm={(opts) => {
            void onConfirmTool({
              count: 1,
              prompt: `宫格切分 ${opts.rows}×${opts.cols}`,
            });
          }}
        />
      ) : null}
      {toolGridResult ? (
        <ToolGridResultPanel
          result={toolGridResult}
          onClose={onToolGridResultClose}
        />
      ) : null}
      <LoginDialog open={loginOpen} onClose={onLoginClose} />
    </>
  );
}
