"use client";

import type { AspectRatio } from "@/components/generation-settings-popover";
import type { ImageModel, VideoModelRouteMeta } from "@/lib/types";
import type {
  CreationLane,
  OutputPreferenceMode,
  VideoDurationSec,
  VideoReferenceMode,
  VideoResolution,
} from "@/lib/creation-dock-prefs";
import { CreationLanePicker } from "./CreationLanePicker";
import { ImageDockSettings } from "./image-lane-settings";
import { VideoDockSettings } from "./video-lane-settings";
import type { DockSkillOption } from "./constants";

/** 按即梦三种模式切换底部按钮组 */
export interface CreationDockToolbarProps {
  creationLane: CreationLane;
  onCreationLaneChange: (lane: CreationLane) => void;
  agentAvailable: boolean;
  disabled?: boolean;
  outputPrefMode: OutputPreferenceMode;
  onOutputPrefModeChange: (mode: OutputPreferenceMode) => void;
  dockSkillOptions: DockSkillOption[];
  dockSkillId: string | null;
  onDockSkillChange: (id: string | null) => void;
  skillTriggerLabel?: string;
  onInspirationClick?: () => void;
  inspirationActive?: boolean;
  models: ImageModel[];
  modelId: string;
  onModelChange: (id: string) => void;
  count: number;
  onCountChange: (n: number) => void;
  resolution: string;
  aspectRatio: AspectRatio;
  onResolutionChange: (v: string) => void;
  onAspectRatioChange: (v: AspectRatio) => void;
  videoReferenceMode: VideoReferenceMode;
  onVideoReferenceModeChange: (mode: VideoReferenceMode) => void;
  videoDurationSec: VideoDurationSec;
  onVideoDurationSecChange: (sec: VideoDurationSec) => void;
  videoResolution: VideoResolution;
  onVideoResolutionChange: (v: VideoResolution) => void;
  smartMultiShotCount?: number;
  videoAutoLabel?: string;
  videoRoutes?: VideoModelRouteMeta[];
}

export function CreationDockToolbar({
  creationLane,
  onCreationLaneChange,
  agentAvailable,
  disabled = false,
  outputPrefMode,
  onOutputPrefModeChange,
  dockSkillOptions,
  dockSkillId,
  onDockSkillChange,
  skillTriggerLabel = "使用技能",
  onInspirationClick,
  inspirationActive = false,
  models,
  modelId,
  onModelChange,
  count,
  onCountChange,
  resolution,
  aspectRatio,
  onResolutionChange,
  onAspectRatioChange,
  videoReferenceMode,
  onVideoReferenceModeChange,
  videoDurationSec,
  onVideoDurationSecChange,
  videoResolution,
  onVideoResolutionChange,
  smartMultiShotCount,
  videoAutoLabel,
  videoRoutes,
}: CreationDockToolbarProps) {
  return (
    <>
      <CreationLanePicker
        value={creationLane}
        onChange={onCreationLaneChange}
        agentAvailable={agentAvailable}
        disabled={disabled}
      />
      {/* Agent 模式：仅保留创作方式切换，与图片/视频车道一样简洁 */}
      {creationLane === "image" ? (
        <ImageDockSettings
          models={models}
          modelId={modelId}
          onModelChange={onModelChange}
          count={count}
          onCountChange={onCountChange}
          resolution={resolution}
          aspectRatio={aspectRatio}
          onResolutionChange={onResolutionChange}
          onAspectRatioChange={onAspectRatioChange}
          disabled={disabled}
        />
      ) : null}
      {creationLane === "video" ? (
        <VideoDockSettings
          models={models}
          modelId={modelId}
          onModelChange={onModelChange}
          aspectRatio={aspectRatio}
          onAspectRatioChange={onAspectRatioChange}
          referenceMode={videoReferenceMode}
          onReferenceModeChange={onVideoReferenceModeChange}
          durationSec={videoDurationSec}
          onDurationSecChange={onVideoDurationSecChange}
          videoResolution={videoResolution}
          onVideoResolutionChange={onVideoResolutionChange}
          smartMultiShotCount={smartMultiShotCount}
          videoAutoLabel={videoAutoLabel}
          videoRoutes={videoRoutes}
          disabled={disabled}
        />
      ) : null}
    </>
  );
}