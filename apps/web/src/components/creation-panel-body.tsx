"use client";

import type { RefObject } from "react";
import {
  ArrowUp,
  AtSign,
  ImagePlus,
  Loader2,
  Pencil,
  RefreshCw,
  Sparkles,
  Wand2,
} from "lucide-react";
import {
  Button,
  ModeTabs,
  type CreationMode,
} from "@aimarket/ui";
import { modeTabs, placeholders, PRODUCTION_DOCK_PLACEHOLDER } from "@/lib/modes";
import { getToken } from "@/lib/api/core";
import { MentionPicker } from "@/components/mention-picker";
import type { CanvasItem, CanvasMaskSelection } from "@/lib/canvas-tools";
import { CreationPanelPill } from "@/components/creation-panel-primitives";
import { CreationPanelInspirationVars } from "@/components/creation-panel-inspiration-vars";
import { CreationPanelJobStatusBar } from "@/components/creation-panel-job-status-bar";
import { UploadPreviewStack, type UploadPreviewItem } from "@/components/upload-preview-stack";
import {
  GenerationSettingsPopover,
  type AspectRatio,
} from "@/components/generation-settings-popover";
import { ModelPicker } from "@/components/model-picker";
import { videoAutoPickerLabel } from "@/lib/video-auto-model";
import { CountPicker } from "@/components/count-picker";
import type { StudioInspirationApply } from "@/lib/inspiration-studio";
import { FocusEditChips } from "@/components/focus-edit-chips";
import { AgentRunPanel } from "@/components/agent-run-panel";
import { SkillPackagePicker } from "@/components/skill-package-picker";
import { SkillRunPanel } from "@/components/skill-run-panel";
import {
  CreationDockToolbar,
  CreationLanePicker,
} from "@/components/creation-dock-controls";
import {
  CREATION_LANE_PLACEHOLDERS,
  type CreationLane,
  type OutputPreferenceMode,
  type SmartMultiShot,
  type VideoDurationSec,
  type VideoMediaRef,
  type VideoReferenceMode,
  type VideoResolution,
} from "@/lib/creation-dock-prefs";
import { VideoReferenceDockControl } from "@/components/video-reference-slots";
import { ReferenceChips } from "@/components/reference-chips";
import type { ReferenceChipItem } from "@/components/reference-chips";
import type { MentionItem } from "@/components/mention-picker";
import type {
  FocusEditIntent,
  FocusPointChip,
} from "@/lib/focus-edit";
import type {
  AgentRun,
  AgentSkillPublic,
  ImageModel,
  SessionReference,
  SkillRun,
  VideoModelRouteMeta,
} from "@/lib/types";
import type { VideoAutoMeta } from "@/lib/video-auto-model";
import type { VideoPickCandidate } from "@/lib/canvas-video-reference-bind";
import {
  flattenCreationPanelBodyProps,
  type CreationPanelBodyProps,
} from "@/components/creation-panel-body-props";

export function CreationPanelBody(props: CreationPanelBodyProps) {
  const flat = flattenCreationPanelBodyProps(props);
  const {
    showDockJobStatusBar,
    jobStreamStatus,
    streamBusy,
    jobStatusSubtext,
    pollingJobId,
    onCancelJob,
    effectiveCollapsed,
    inspirationApply,
    inspirationVars,
    setInspirationVars,
    showModeTabs,
    variant,
    mode,
    setMode,
    fileRef,
    uploadTarget,
    handleUpload,
    isDock,
    dockCompactLine,
    creationLane,
    canvasItems,
    mentionUploadedAssets,
    references,
    mentionQuery,
    mentionOpen,
    insertMention,
    setMentionOpen,
    setMentionQuery,
    setDockFocused,
    setDockExpanded,
    openUpload,
    dockIconBtnClassSm,
    uploading,
    videoReferenceMode,
    videoReferences,
    setVideoReferences,
    smartMultiShots,
    setSmartMultiShots,
    firstLastMotionPrompt,
    setFirstLastMotionPrompt,
    uploadVideoReference,
    videoPickCandidates,
    videoPickCandidatesLoading,
    applyVideoPickCandidate,
    readOnly,
    pending,
    videoUploading,
    smartMultiDegraded,
    agentLaneAvailable,
    handleCreationLaneChange,
    showInlineUploadStack,
    uploadPreviews,
    setUploadPreviewIndex,
    setUploadPreviews,
    setAssetIds,
    isStudioDock,
    textareaRef,
    prompt,
    setPrompt,
    polishCandidates,
    resetPolish,
    syncMentionStateFromPrompt,
    rotatingPlaceholder,
    rotatingText,
    effectiveMode,
    dockShouldExpand,
    submitOnEnter,
    handleSubmitAttempt,
    enablePolish,
    polishBusy,
    polishHint,
    handlePolish,
    cyclePolishCandidate,
    polishCandidateIndex,
    referenceChips,
    handleRemoveReferenceChip,
    mentionedMasks,
    focusEdit,
    sessionId,
    assetIds,
    routeHint,
    skillsEnabled,
    skillPackages,
    selectedSkillId,
    skillInFlight,
    orchSkillBusy,
    orchSkillRun,
    skillIdle,
    setSelectedSkillId,
    activeSkillId,
    selectedSkill,
    skillRun,
    skillBusy,
    handleSubmit,
    cancelSkillRunAction,
    agentEnabled,
    homeDirectSubmit,
    agentRun,
    agentBusy,
    cancelAgentRunAction,
    showStackUpload,
    dockIconBtnClass,
    reversing,
    handlePromptReverse,
    outputPrefMode,
    handleOutputPrefModeChange,
    models,
    modelId,
    setModelId,
    count,
    setCount,
    resolution,
    aspectRatio,
    setResolution,
    setAspectRatio,
    handleVideoReferenceModeChange,
    videoDurationSec,
    setVideoDurationSec,
    videoResolution,
    setVideoResolution,
    videoAutoMeta,
    videoRoutes,
    isVideoModel,
    estimated,
    user,
    submitAriaLabel,
    submitLoading,
  } = flat;

  return (
    <>
      {showDockJobStatusBar ? (
        <CreationPanelJobStatusBar
          jobStreamStatus={jobStreamStatus}
          streamBusy={streamBusy}
          jobStatusSubtext={jobStatusSubtext}
          pollingJobId={pollingJobId}
          onCancelJob={onCancelJob}
        />
      ) : null}

      {!effectiveCollapsed && inspirationApply ? (
        <CreationPanelInspirationVars
          inspirationApply={inspirationApply}
          inspirationVars={inspirationVars}
          onInspirationVarChange={(key, value) =>
            setInspirationVars((prev) => ({ ...prev, [key]: value }))
          }
        />
      ) : null}

      {showModeTabs && variant === "default" ? (
        <div className="mb-4 flex justify-center overflow-x-auto">
          <ModeTabs items={modeTabs} value={mode} onChange={setMode} />
        </div>
      ) : null}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={uploadTarget === "general"}
        className="hidden"
        onChange={(e) => {
          /** FileList 与 input 联动；清空 value 前必须拷贝成普通数组。 */
          const picked = Array.from(e.currentTarget.files ?? []);
          e.target.value = "";
          void handleUpload(picked);
        }}
      />

      <div className={`relative ${isDock ? "" : "mt-3"}`}>
        <MentionPicker
          placement="above"
          canvasItems={canvasItems}
          uploadedAssets={mentionUploadedAssets}
          references={references}
          query={mentionQuery}
          open={mentionOpen}
          onSelect={insertMention}
          onClose={() => {
            setMentionOpen(false);
            setMentionQuery("");
          }}
        />
        <div
          className={
            isDock
              ? dockCompactLine
                ? "px-2.5 py-1.5 sm:px-3"
                : "px-3 pb-2.5 pt-2.5 sm:px-3.5"
              : ""
          }
          onFocusCapture={() => {
            if (!isDock) return;
            setDockFocused(true);
            setDockExpanded(true);
          }}
        >
          <div
            className={`relative flex min-w-0 gap-2 ${dockCompactLine ? "items-center" : "items-start"}`}
          >
            {dockCompactLine && creationLane !== "video" ? (
              <button
                type="button"
                onClick={() => openUpload("general")}
                className={dockIconBtnClassSm}
                aria-label="上传图片"
                title="上传图片"
              >
                {uploading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <ImagePlus className="size-3.5" />
                )}
              </button>
            ) : null}
            {isDock && creationLane === "video" ? (
              <VideoReferenceDockControl
                mode={videoReferenceMode}
                videoReferences={videoReferences}
                onVideoReferencesChange={setVideoReferences}
                smartMultiShots={smartMultiShots}
                onSmartMultiShotsChange={setSmartMultiShots}
                motionPrompt={firstLastMotionPrompt}
                onMotionPromptChange={setFirstLastMotionPrompt}
                onUpload={uploadVideoReference}
                pickCandidates={videoPickCandidates}
                pickCandidatesLoading={videoPickCandidatesLoading}
                onPickCandidate={applyVideoPickCandidate}
                disabled={readOnly || pending || streamBusy}
                uploading={videoUploading}
                smartMultiDegraded={smartMultiDegraded}
              />
            ) : null}
            {dockCompactLine ? (
              <div className="min-w-0 shrink-0 scale-90">
                <CreationLanePicker
                  value={creationLane}
                  onChange={handleCreationLaneChange}
                  agentAvailable={agentLaneAvailable}
                  disabled={readOnly || pending || streamBusy}
                />
              </div>
            ) : null}
            {showInlineUploadStack ? (
              <UploadPreviewStack
                items={uploadPreviews}
                uploading={uploading}
                onAdd={() => openUpload("general")}
                compact={isDock}
                onPreview={(index) => setUploadPreviewIndex(index)}
                onRemove={(id) => {
                  setUploadPreviews((prev) => prev.filter((p) => p.id !== id));
                  setAssetIds((prev) => prev.filter((a) => a !== id));
                }}
              />
            ) : null}
            <div
              className={`relative flex min-w-0 flex-1 gap-2 ${isDock && isStudioDock ? "pr-9 sm:pr-10" : ""}`}
            >
              {isDock && isStudioDock ? (
                <div
                  className="pointer-events-none mt-2 shrink-0 self-start text-zinc-500"
                  aria-hidden
                >
                  <Pencil className="size-3.5" strokeWidth={1.75} />
                </div>
              ) : null}
              <div
                className="relative min-w-0 flex-1"
                onClick={() => {
                  if (isDock) setDockExpanded(true);
                  textareaRef.current?.focus();
                }}
              >
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => {
                  const v = e.target.value;
                  setPrompt(v);
                  if (polishCandidates.length > 0) {
                    resetPolish();
                  }
                  syncMentionStateFromPrompt(v);
                  // 检测光标前的 @<query>，弹出/更新引用 popover
                  const caret = e.target.selectionStart ?? v.length;
                  const before = v.slice(0, caret);
                  const atIdx = before.lastIndexOf("@");
                  if (atIdx >= 0) {
                    const between = before.slice(atIdx + 1);
                    // @ 后仅空格仍展示列表；出现「空格+非空字符」视为已结束 mention 段
                    if (
                      !between.includes("\n") &&
                      !/\s\S/.test(between)
                    ) {
                      setMentionOpen(true);
                      setMentionQuery(between.trimStart());
                      return;
                    }
                  }
                  if (mentionOpen) {
                    setMentionOpen(false);
                    setMentionQuery("");
                  }
                }}
                placeholder={
                  isDock && !prompt.trim()
                    ? mode === "production"
                      ? rotatingPlaceholder
                        ? rotatingText
                        : PRODUCTION_DOCK_PLACEHOLDER
                      : creationLane === "image" && rotatingPlaceholder
                        ? rotatingText
                        : CREATION_LANE_PLACEHOLDERS[creationLane]
                    : effectiveMode === "ecommerce"
                      ? placeholders.ecommerce
                      : mode === "chat"
                        ? "输入想要的修改效果，@ 可引用画布上的图片"
                        : placeholders[mode]
                }
                rows={
                  effectiveCollapsed
                    ? 1
                    : effectiveMode === "ecommerce"
                      ? 3
                      : isDock
                        ? dockShouldExpand
                          ? 2
                          : 1
                        : 2
                }
                readOnly={readOnly}
                className={`w-full resize-none bg-transparent text-sm outline-none placeholder:text-zinc-600 ${
                  readOnly ? "cursor-not-allowed opacity-60" : ""
                } ${
                  isDock
                    ? `${dockShouldExpand ? "min-h-[52px] leading-7" : "min-h-[24px] leading-6 focus:min-h-[52px] focus:leading-7"} pr-9 text-zinc-100 transition-[min-height] duration-200`
                    : "rounded-2xl border border-white/10 bg-black/40 px-4 py-3 focus:border-purple-500/40"
                }`}
                onFocus={() => {
                  setDockFocused(true);
                  if (isDock) setDockExpanded(true);
                }}
                onPointerDown={() => {
                  if (isDock) setDockExpanded(true);
                }}
                onClick={() => {
                  if (isDock) setDockExpanded(true);
                }}
                onBlur={() => {
                  setDockFocused(false);
                }}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    (submitOnEnter ? !e.shiftKey : e.metaKey || e.ctrlKey)
                  ) {
                    e.preventDefault();
                    handleSubmitAttempt();
                  }
                }}
              />
              {enablePolish ? (
                <button
                  type="button"
                  title={
                    polishBusy
                      ? "润色中…"
                      : polishHint
                        ? `已润色（${polishHint}）`
                        : prompt.trim()
                          ? "润色 Prompt"
                          : "输入描述后可一键润色"
                  }
                  disabled={!prompt.trim() || polishBusy}
                  onClick={handlePolish}
                  className={`absolute bottom-1 right-1 rounded-lg p-1.5 transition ${
                    prompt.trim() && !polishBusy
                      ? "text-orange-400 hover:bg-white/10 hover:text-orange-300"
                      : "pointer-events-none text-zinc-600 opacity-70"
                  }`}
                  aria-label="润色描述"
                >
                  {polishBusy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Wand2 className="size-4" />
                  )}
                </button>
              ) : null}
              {enablePolish && polishCandidates.length > 1 && !polishBusy ? (
                <button
                  type="button"
                  title={`换一个（${polishCandidateIndex + 1}/${polishCandidates.length}）`}
                  onClick={cyclePolishCandidate}
                  className="absolute bottom-1 right-9 rounded-lg p-1.5 text-orange-400 transition hover:bg-white/10 hover:text-orange-300"
                  aria-label="换一个润色结果"
                >
                  <RefreshCw className="size-4" />
                </button>
              ) : null}
              </div>
            </div>
            {dockCompactLine ? (
              <Button
                  variant="primary"
                  className="size-8 shrink-0 rounded-full p-0"
                  onClick={handleSubmitAttempt}
                  disabled={readOnly || pending || streamBusy}
                  aria-label={submitAriaLabel}
                >
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ArrowUp className="size-4" />
                  )}
                </Button>
            ) : null}
          </div>
        {!dockCompactLine && referenceChips.length > 0 ? (
          <ReferenceChips
            chips={referenceChips}
            onRemove={handleRemoveReferenceChip}
          />
        ) : null}
        {!dockCompactLine && mentionedMasks.length > 0 ? (
          <p className="mt-1 text-xs text-amber-300">
            已圈选 {mentionedMasks.length} 个局部区域，将随提示词一起提交
          </p>
        ) : null}
        {!dockCompactLine && focusEdit ? (
          <FocusEditChips
            points={focusEdit.points}
            intent={focusEdit.intent}
            cropSize={focusEdit.cropSize}
            recognizing={focusEdit.recognizing}
            sessionId={sessionId}
            onIntentChange={focusEdit.onIntentChange}
            onRemove={focusEdit.onRemovePoint}
            onEdit={focusEdit.onEditPoint}
            onChipPromptChange={focusEdit.onChipPromptChange}
            onReplaceImage={focusEdit.onReplaceImage}
            onClearAll={focusEdit.onClearAll}
            onCropSizeChange={focusEdit.onCropSizeChange}
            onCancel={focusEdit.onCancel}
          />
        ) : null}
        {!dockCompactLine && assetIds.length > 0 && !(isDock && isStudioDock) ? (
          <p className="mt-1 text-xs text-zinc-500">
            已上传 {assetIds.length} 张附件
          </p>
        ) : null}
        {!dockCompactLine && routeHint && !(isDock && isStudioDock) ? (
          <p className="mt-1 text-xs text-orange-400/80">路由：{routeHint}</p>
        ) : null}

        {skillsEnabled && !isDock && !effectiveCollapsed && !dockCompactLine && !focusEdit ? (
          <SkillPackagePicker
            skills={skillPackages}
            selectedId={selectedSkillId}
            disabled={
              skillInFlight || orchSkillBusy || Boolean(orchSkillRun && !skillIdle)
            }
            onSelect={setSelectedSkillId}
          />
        ) : null}

        {skillsEnabled &&
        activeSkillId &&
        !effectiveCollapsed &&
        !dockCompactLine &&
        !isStudioDock ? (
          <SkillRunPanel
            skill={selectedSkill}
            run={skillRun}
            confirmBusy={skillBusy || pending}
            onConfirm={() => void handleSubmit()}
            onCancelRun={() => void cancelSkillRunAction()}
          />
        ) : null}

        {agentEnabled &&
        !activeSkillId &&
        (!isDock || creationLane === "agent") &&
        !effectiveCollapsed &&
        !dockCompactLine &&
        !isStudioDock &&
        !homeDirectSubmit ? (
          <AgentRunPanel
            prompt={prompt}
            mode={effectiveMode}
            enabled={agentEnabled && !focusEdit}
            run={agentRun}
            confirmBusy={agentBusy || pending}
            onConfirm={() => void handleSubmit()}
            onCancelRun={() => void cancelAgentRunAction()}
          />
        ) : null}

          {dockCompactLine ? null : effectiveCollapsed ? (
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                {!showStackUpload ? (
                  <button
                    type="button"
                    onClick={() => openUpload("general")}
                    className={dockIconBtnClassSm}
                    aria-label="上传图片"
                    title="上传图片"
                  >
                    {uploading ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <ImagePlus className="size-3.5" />
                    )}
                  </button>
                ) : null}
                {sessionId ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMentionQuery("");
                      setMentionOpen(true);
                      textareaRef.current?.focus();
                    }}
                    className={dockIconBtnClassSm}
                    aria-label="引用画布图片"
                    title="@ 引用画布图片"
                  >
                    <AtSign className="size-3.5" />
                  </button>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  variant="primary"
                  className="size-9 shrink-0 rounded-full p-0"
                  onClick={handleSubmitAttempt}
                  disabled={readOnly || pending || streamBusy}
                  aria-label={submitAriaLabel}
                >
                  {pending ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <ArrowUp className="size-5" />
                  )}
                </Button>
              </div>
            </div>
          ) : (
          <div
            className={`flex items-center justify-between gap-2 ${isDock ? "mt-3" : "mt-3"} ${
              isDock && isStudioDock
                ? "-mx-1 border-t border-white/[0.06] px-1 pt-2.5 sm:-mx-1.5 sm:px-1.5"
                : ""
            }`}
          >
        <div
          className={
            isDock
              ? "flex min-w-0 flex-1 items-center gap-2 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              : "flex flex-wrap items-center gap-2"
          }
        >
          {!showStackUpload ? (
            <button
              type="button"
              onClick={() => openUpload("general")}
              className={dockIconBtnClass}
              aria-label="上传图片"
              title="上传图片"
            >
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ImagePlus className="size-4" />
              )}
            </button>
          ) : null}
          {sessionId ? (
            <button
              type="button"
              onClick={() => {
                setMentionQuery("");
                setMentionOpen(true);
                textareaRef.current?.focus();
              }}
              className={dockIconBtnClass}
              aria-label="引用画布图片"
              title="@ 引用画布图片"
            >
              <AtSign className="size-4" />
            </button>
          ) : null}
          {enablePolish && (assetIds.length > 0 || uploadPreviews.length > 0) ? (
            <button
              type="button"
              title="根据图片反推 Prompt（图生文）"
              disabled={reversing || streamBusy}
              onClick={() => void handlePromptReverse()}
              className={`${dockIconBtnClass} disabled:opacity-50`}
              aria-label="图生文"
            >
              {reversing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
            </button>
          ) : null}
          {isDock ? (
            <CreationDockToolbar
              creationLane={creationLane}
              onCreationLaneChange={handleCreationLaneChange}
              agentAvailable={agentLaneAvailable}
              disabled={readOnly || pending || streamBusy}
              outputPrefMode={outputPrefMode}
              onOutputPrefModeChange={handleOutputPrefModeChange}
              dockSkillOptions={[]}
              dockSkillId={null}
              onDockSkillChange={() => {}}
              models={models}
              modelId={modelId}
              onModelChange={setModelId}
              count={count}
              onCountChange={setCount}
              resolution={resolution}
              aspectRatio={aspectRatio}
              onResolutionChange={setResolution}
              onAspectRatioChange={setAspectRatio}
              videoReferenceMode={videoReferenceMode}
              onVideoReferenceModeChange={handleVideoReferenceModeChange}
              videoDurationSec={videoDurationSec}
              onVideoDurationSecChange={setVideoDurationSec}
              videoResolution={videoResolution}
              onVideoResolutionChange={setVideoResolution}
              smartMultiShotCount={smartMultiShots.length}
              videoAutoLabel={videoAutoPickerLabel(
                modelId,
                models,
                videoAutoMeta,
              )}
              videoRoutes={videoRoutes}
            />
          ) : effectiveMode !== "ecommerce" ? (
            <>
              <ModelPicker
                models={models}
                value={modelId}
                onChange={setModelId}
                videoRoutes={isVideoModel ? videoRoutes : undefined}
              />
              <CountPicker value={count} onChange={setCount} max={4} />
              <GenerationSettingsPopover
                mode={mode}
                resolution={resolution}
                aspectRatio={aspectRatio}
                onResolutionChange={setResolution}
                onAspectRatioChange={setAspectRatio}
                videoMode={isVideoModel}
              />
            </>
          ) : (
            <>
              <CreationPanelPill>最新图片 V2 Pro · 4 张 · 2K</CreationPanelPill>
              <CreationPanelPill>
                智能 · {resolution.toUpperCase()} · 1:1 套图
              </CreationPanelPill>
            </>
          )}
        </div>
        <div className={`flex shrink-0 items-center ${isDock ? "gap-1.5" : "gap-2"}`}>
          {estimated !== null && user && getToken() ? (
            <span
              className="inline-flex items-center gap-1 text-xs text-pink-400"
              title="本次消耗积分"
            >
              <Sparkles className="size-3.5 fill-pink-400/30" />
              {estimated}
            </span>
          ) : null}
          <Button
            variant="primary"
            className={`size-9 shrink-0 rounded-full p-0 sm:size-10 ${
              isDock && isStudioDock
                ? "shadow-[0_0_22px_rgba(249,115,22,0.35)] transition-shadow hover:shadow-[0_0_28px_rgba(249,115,22,0.45)]"
                : ""
            }`}
            onClick={handleSubmitAttempt}
            disabled={readOnly || pending || streamBusy}
            aria-label={submitAriaLabel}
          >
            {submitLoading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <ArrowUp className="size-5" />
            )}
          </Button>
        </div>
          </div>
          )}
        </div>
      </div>
    </>

  );
}
