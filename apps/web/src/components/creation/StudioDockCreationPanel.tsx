"use client";

import { forwardRef } from "react";
import type { CreationMode } from "@aimarket/ui";

import {
  CreationPanel,
  type CreationPanelHandle,
} from "@/components/creation-panel";
import type { CanvasItem, CanvasMaskSelection } from "@/lib/canvas-tools";
import type { PendingAsset } from "@/lib/pending-assets";
import type { StudioInspirationApply } from "@/lib/inspiration-studio";
import type { StudioDockMode } from "@/lib/studio-dock-state";
import type {
  FocusEditIntent,
  FocusPointChip,
} from "@/lib/focus-edit";

export type StudioDockCreationPanelProps = {
  readOnly: boolean;
  mode: CreationMode;
  sessionId: string;
  initialPrompt: string;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  restoredAssets?: PendingAsset[];
  inspirationApply?: StudioInspirationApply | null;
  onAuthRequired: () => void;
  onJobStarted: (jobId: string) => void;
  jobStreamStatus: string | null;
  pollingJobId: string | null;
  onCancelJob: () => void;
  jobElapsedMs?: number;
  queueAhead?: number | null;
  canvasItems: CanvasItem[];
  selectedCanvasItem?: CanvasItem | null;
  onClearCanvasSelection?: () => void;
  mentionItemRequest: {
    key: number;
    item: CanvasItem;
    promptSuffix?: string;
    maskSelection?: CanvasMaskSelection;
  } | null;
  onUploadToCanvas: (assetId: string, url: string, thumbUrl?: string) => void;
  onDockModeChange: (mode: StudioDockMode) => void;
  dockExpanded?: boolean;
  focusEdit: {
    points: FocusPointChip[];
    intent: FocusEditIntent;
    cropSize?: number;
    recognizing?: boolean;
    onIntentChange: (intent: FocusEditIntent) => void;
    onRemovePoint: (pointId: string) => void;
    onEditPoint: (pointId: string, newName: string) => void;
    onChipPromptChange: (pointId: string, chipPrompt: string) => void;
    onReplaceImage: (pointId: string, assetId: string, url: string) => void;
    onClearAll: () => void;
    onCropSizeChange: (size: number) => void;
    onCancel: () => void;
  } | null;
  onFocusEditSubmit: (args: {
    prompt: string;
    intent: FocusEditIntent;
    points: FocusPointChip[];
    item: CanvasItem;
  }) => Promise<string>;
  autoSubmitOnce?: boolean;
};

/** Studio 底部 Dock：variant=studio-dock，编排由 Provider 负责 */
export const StudioDockCreationPanel = forwardRef<
  CreationPanelHandle,
  StudioDockCreationPanelProps
>(function StudioDockCreationPanel(
  {
    readOnly,
    mode,
    sessionId,
    initialPrompt,
    prompt,
    onPromptChange,
    restoredAssets,
    inspirationApply,
    onAuthRequired,
    onJobStarted,
    jobStreamStatus,
    pollingJobId,
    onCancelJob,
    jobElapsedMs,
    queueAhead,
    canvasItems,
    selectedCanvasItem = null,
    onClearCanvasSelection,
    mentionItemRequest,
    onUploadToCanvas,
    onDockModeChange,
    dockExpanded = true,
    focusEdit,
    onFocusEditSubmit,
    autoSubmitOnce = false,
  },
  ref,
) {
  return (
    <CreationPanel
      ref={ref}
      variant="studio-dock"
      onDockModeChange={onDockModeChange}
      initialDockExpanded={dockExpanded}
      showModeTabs={false}
      rotatingPlaceholder
      enablePolish
      mode={mode}
      sessionId={sessionId}
      initialPrompt={initialPrompt}
      prompt={prompt}
      onPromptChange={onPromptChange}
      restoredAssets={restoredAssets}
      inspirationApply={inspirationApply}
      onAuthRequired={onAuthRequired}
      onJobStarted={onJobStarted}
      jobStreamStatus={jobStreamStatus}
      pollingJobId={pollingJobId}
      onCancelJob={onCancelJob}
      jobElapsedMs={jobElapsedMs}
      queueAhead={queueAhead}
      readOnly={readOnly}
      canvasItems={canvasItems}
      selectedCanvasItem={selectedCanvasItem}
      onClearCanvasSelection={onClearCanvasSelection}
      mentionItemRequest={mentionItemRequest}
      onUploadToCanvas={onUploadToCanvas}
      focusEdit={focusEdit}
      agentOrchestration
      agentSkills={false}
      onFocusEditSubmit={onFocusEditSubmit}
      autoSubmitOnce={autoSubmitOnce}
    />
  );
});
