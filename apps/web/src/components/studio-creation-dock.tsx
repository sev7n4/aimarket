"use client";

import { StudioDockCreationPanel } from "@/components/creation/StudioDockCreationPanel";
import type { CanvasItem, CanvasMaskSelection } from "@/lib/canvas-tools";
import type { PendingAsset } from "@/lib/pending-assets";
import type { StudioInspirationApply } from "@/lib/inspiration-studio";
import type { StudioDockMode } from "@/lib/studio-dock-state";
import type { CreationMode } from "@aimarket/ui";
import type {
  FocusEditIntent,
  FocusPointChip,
} from "@/lib/focus-edit";

interface StudioCreationDockProps {
  user: unknown;
  ready: boolean;
  readOnly: boolean;
  mode: CreationMode;
  sessionId: string;
  initialPrompt: string;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  restoredAssets?: PendingAsset[];
  inspirationApply?: StudioInspirationApply | null;
  onLogin: () => void;
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
}

/** Studio 底部 Dock：prompt、上传、@、车道、Skill、发送（编排由 Provider 负责） */
export function StudioCreationDock({
  user,
  ready,
  readOnly,
  mode,
  sessionId,
  initialPrompt,
  prompt,
  onPromptChange,
  restoredAssets,
  inspirationApply,
  onLogin,
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
}: StudioCreationDockProps) {
  return (
    <>
      {!user || !ready ? (
        <button
          type="button"
          onClick={onLogin}
          className="mb-2 w-full text-center text-xs text-orange-400"
        >
          登录后开始创作
        </button>
      ) : null}
      {readOnly ? (
        <p className="mb-2 text-center text-xs text-amber-400/90">
          只读会话：无法在此生成或编辑
        </p>
      ) : null}
      <StudioDockCreationPanel
        readOnly={readOnly}
        mode={mode}
        sessionId={sessionId}
        initialPrompt={initialPrompt}
        prompt={prompt}
        onPromptChange={onPromptChange}
        restoredAssets={restoredAssets}
        inspirationApply={inspirationApply}
        onAuthRequired={onLogin}
        onJobStarted={onJobStarted}
        jobStreamStatus={jobStreamStatus}
        pollingJobId={pollingJobId}
        onCancelJob={onCancelJob}
        jobElapsedMs={jobElapsedMs}
        queueAhead={queueAhead}
        canvasItems={canvasItems}
        selectedCanvasItem={selectedCanvasItem}
        onClearCanvasSelection={onClearCanvasSelection}
        mentionItemRequest={mentionItemRequest}
        onUploadToCanvas={onUploadToCanvas}
        onDockModeChange={onDockModeChange}
        dockExpanded={dockExpanded}
        focusEdit={focusEdit}
        onFocusEditSubmit={onFocusEditSubmit}
        autoSubmitOnce={autoSubmitOnce}
      />
    </>
  );
}
