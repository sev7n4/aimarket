import type { RefObject } from "react";
import type { CreationMode } from "@aimarket/ui";
import type { MentionItem } from "@/components/mention-picker";
import type { ReferenceChipItem } from "@/components/reference-chips";
import type { UploadPreviewItem } from "@/components/upload-preview-stack";
import type { AspectRatio } from "@/components/generation-settings-popover";
import type { StudioInspirationApply } from "@/lib/inspiration-studio";
import type { CanvasItem, CanvasMaskSelection } from "@/lib/canvas-tools";
import type {
  CreationLane,
  OutputPreferenceMode,
  SmartMultiShot,
  VideoDurationSec,
  VideoMediaRef,
  VideoReferenceMode,
  VideoResolution,
} from "@/lib/creation-dock-prefs";
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

export type CreationPanelPropsVariant = "default" | "dock" | "studio-dock";

export type CreationPanelBodyFocusEdit = {
  points: FocusPointChip[];
  intent: FocusEditIntent;
  cropSize?: number;
  recognizing?: boolean;
  onIntentChange: (intent: FocusEditIntent) => void;
  onRemovePoint: (pointId: string) => void;
  onEditPoint?: (pointId: string, newName: string) => void;
  onChipPromptChange?: (pointId: string, prompt: string) => void;
  onReplaceImage?: (pointId: string, assetId: string, url: string) => void;
  onClearAll?: () => void;
  onCropSizeChange?: (size: number) => void;
  onCancel?: () => void;
};

export type CreationPanelBodyFlatProps = {
  showDockJobStatusBar: boolean;
  jobStreamStatus: string | null;
  streamBusy: boolean;
  jobStatusSubtext: string | null;
  pollingJobId: string | null;
  onCancelJob?: () => void;
  effectiveCollapsed: boolean;
  inspirationApply: StudioInspirationApply | null;
  inspirationVars: Record<string, string>;
  setInspirationVars: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  showModeTabs: boolean;
  variant: CreationPanelPropsVariant;
  mode: CreationMode;
  setMode: (mode: CreationMode) => void;
  fileRef: RefObject<HTMLInputElement | null>;
  uploadTarget: "product" | "reference" | "general";
  handleUpload: (files: File[]) => void | Promise<void>;
  isDock: boolean;
  dockCompactLine: boolean;
  creationLane: CreationLane;
  canvasItems: CanvasItem[];
  mentionUploadedAssets: Array<{ id: string; url: string; label?: string }>;
  references: SessionReference[];
  mentionQuery: string;
  mentionOpen: boolean;
  insertMention: (item: MentionItem, promptSuffix?: string) => void;
  setMentionOpen: (open: boolean) => void;
  setMentionQuery: (query: string) => void;
  setDockFocused: (focused: boolean) => void;
  setDockExpanded: (expanded: boolean) => void;
  openUpload: (target: "product" | "reference" | "general") => void;
  dockIconBtnClassSm: string;
  uploading: boolean;
  videoReferenceMode: VideoReferenceMode;
  videoReferences: VideoMediaRef[];
  setVideoReferences: (refs: VideoMediaRef[]) => void;
  smartMultiShots: SmartMultiShot[];
  setSmartMultiShots: (shots: SmartMultiShot[]) => void;
  firstLastMotionPrompt: string;
  setFirstLastMotionPrompt: React.Dispatch<React.SetStateAction<string>>;
  uploadVideoReference: (
    file: File,
    role?: VideoMediaRef["role"],
  ) => Promise<{ assetId: string; url: string; mimeType: string }>;
  videoPickCandidates: VideoPickCandidate[];
  videoPickCandidatesLoading: boolean;
  applyVideoPickCandidate: (pick: VideoPickCandidate) => void;
  readOnly: boolean;
  pending: boolean;
  videoUploading: boolean;
  smartMultiDegraded: boolean;
  agentLaneAvailable: boolean;
  handleCreationLaneChange: (lane: CreationLane) => void;
  showInlineUploadStack: boolean;
  uploadPreviews: UploadPreviewItem[];
  setUploadPreviewIndex: (index: number | null) => void;
  setUploadPreviews: React.Dispatch<React.SetStateAction<UploadPreviewItem[]>>;
  setAssetIds: React.Dispatch<React.SetStateAction<string[]>>;
  isStudioDock: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  prompt: string;
  setPrompt: (p: string | ((prev: string) => string)) => void;
  polishCandidates: string[];
  resetPolish: () => void;
  syncMentionStateFromPrompt: (prompt: string) => void;
  rotatingPlaceholder: boolean;
  rotatingText: string;
  effectiveMode: CreationMode;
  dockShouldExpand: boolean;
  submitOnEnter: boolean;
  handleSubmitAttempt: () => void;
  enablePolish: boolean;
  polishBusy: boolean;
  polishHint: string | null;
  handlePolish: () => void;
  cyclePolishCandidate: () => void;
  polishCandidateIndex: number;
  referenceChips: ReferenceChipItem[];
  handleRemoveReferenceChip: (chip: ReferenceChipItem) => void;
  mentionedMasks: CanvasMaskSelection[];
    sessionId?: string;
  assetIds: string[];
  routeHint: string | null;
  skillsEnabled: boolean;
  skillPackages: AgentSkillPublic[];
  selectedSkillId: string | null;
  skillInFlight: boolean;
  orchSkillBusy: boolean;
  orchSkillRun: SkillRun | null;
  skillIdle: boolean;
  setSelectedSkillId: (id: string | null) => void;
  activeSkillId: string | null;
  selectedSkill: AgentSkillPublic | null;
  skillRun: SkillRun | null;
  skillBusy: boolean;
  handleSubmit: () => void | Promise<void>;
  cancelSkillRunAction: () => void | Promise<SkillRun | null>;
  agentEnabled: boolean;
  homeDirectSubmit: boolean;
  agentRun: AgentRun | null;
  agentBusy: boolean;
  cancelAgentRunAction: () => void | Promise<AgentRun | null>;
  showStackUpload: boolean;
  dockIconBtnClass: string;
  reversing: boolean;
  handlePromptReverse: () => void | Promise<void>;
  outputPrefMode: OutputPreferenceMode;
  handleOutputPrefModeChange: (mode: OutputPreferenceMode) => void;
  models: ImageModel[];
  modelId: string;
  setModelId: (id: string) => void;
  count: number;
  setCount: (count: number) => void;
  resolution: string;
  aspectRatio: AspectRatio;
  setResolution: (resolution: string) => void;
  setAspectRatio: (ratio: AspectRatio) => void;
  handleVideoReferenceModeChange: (mode: VideoReferenceMode) => void;
  videoDurationSec: VideoDurationSec;
  setVideoDurationSec: (sec: VideoDurationSec) => void;
  videoResolution: VideoResolution;
  setVideoResolution: (resolution: VideoResolution) => void;
  videoAutoMeta: VideoAutoMeta | null;
  videoRoutes: VideoModelRouteMeta[];
  isVideoModel: boolean;
  estimated: number | null;
  user: { id: string } | null;
  submitAriaLabel: string;
  submitLoading: boolean;
};

export type CreationPanelBodyJobProps = Pick<CreationPanelBodyFlatProps, 'showDockJobStatusBar' | 'jobStreamStatus' | 'streamBusy' | 'jobStatusSubtext' | 'pollingJobId' | 'onCancelJob'>;

export type CreationPanelBodyShellProps = Pick<CreationPanelBodyFlatProps, 'effectiveCollapsed' | 'inspirationApply' | 'inspirationVars' | 'setInspirationVars' | 'showModeTabs' | 'variant' | 'mode' | 'setMode' | 'effectiveMode'>;

export type CreationPanelBodyUploadProps = Pick<CreationPanelBodyFlatProps, 'fileRef' | 'uploadTarget' | 'handleUpload' | 'openUpload' | 'uploading' | 'uploadPreviews' | 'setUploadPreviewIndex' | 'setUploadPreviews' | 'setAssetIds' | 'assetIds' | 'showStackUpload' | 'showInlineUploadStack' | 'mentionUploadedAssets'>;

export type CreationPanelBodyDockProps = Pick<CreationPanelBodyFlatProps, 'isDock' | 'isStudioDock' | 'dockCompactLine' | 'dockShouldExpand' | 'dockIconBtnClass' | 'dockIconBtnClassSm' | 'setDockFocused' | 'setDockExpanded'>;

export type CreationPanelBodyLaneProps = Pick<CreationPanelBodyFlatProps, 'creationLane' | 'agentLaneAvailable' | 'handleCreationLaneChange' | 'outputPrefMode' | 'handleOutputPrefModeChange'>;

export type CreationPanelBodyMentionProps = Pick<CreationPanelBodyFlatProps, 'canvasItems' | 'references' | 'mentionQuery' | 'mentionOpen' | 'insertMention' | 'setMentionOpen' | 'setMentionQuery' | 'referenceChips' | 'handleRemoveReferenceChip' | 'mentionedMasks' | 'syncMentionStateFromPrompt'>;

export type CreationPanelBodyVideoProps = Pick<CreationPanelBodyFlatProps, 'videoReferenceMode' | 'videoReferences' | 'setVideoReferences' | 'smartMultiShots' | 'setSmartMultiShots' | 'firstLastMotionPrompt' | 'setFirstLastMotionPrompt' | 'uploadVideoReference' | 'videoPickCandidates' | 'videoPickCandidatesLoading' | 'applyVideoPickCandidate' | 'videoUploading' | 'smartMultiDegraded' | 'handleVideoReferenceModeChange' | 'videoDurationSec' | 'setVideoDurationSec' | 'videoResolution' | 'setVideoResolution' | 'videoAutoMeta' | 'videoRoutes'>;

export type CreationPanelBodyPromptProps = Pick<CreationPanelBodyFlatProps, 'textareaRef' | 'prompt' | 'setPrompt' | 'submitOnEnter' | 'rotatingPlaceholder' | 'rotatingText' | 'routeHint' | 'sessionId'>;

export type CreationPanelBodyPolishProps = Pick<CreationPanelBodyFlatProps, 'enablePolish' | 'polishBusy' | 'polishHint' | 'polishCandidates' | 'polishCandidateIndex' | 'handlePolish' | 'cyclePolishCandidate' | 'resetPolish' | 'reversing' | 'handlePromptReverse'>;

export type CreationPanelBodyOrchestrationProps = Pick<CreationPanelBodyFlatProps, 'skillsEnabled' | 'skillPackages' | 'selectedSkillId' | 'skillInFlight' | 'orchSkillBusy' | 'orchSkillRun' | 'skillIdle' | 'setSelectedSkillId' | 'activeSkillId' | 'selectedSkill' | 'skillRun' | 'skillBusy' | 'handleSubmit' | 'cancelSkillRunAction' | 'agentEnabled' | 'homeDirectSubmit' | 'agentRun' | 'agentBusy' | 'cancelAgentRunAction'>;

export type CreationPanelBodyGenerationProps = Pick<CreationPanelBodyFlatProps, 'models' | 'modelId' | 'setModelId' | 'count' | 'setCount' | 'resolution' | 'aspectRatio' | 'setResolution' | 'setAspectRatio' | 'isVideoModel' | 'estimated' | 'user'>;

export type CreationPanelBodySubmitProps = Pick<CreationPanelBodyFlatProps, 'readOnly' | 'pending' | 'handleSubmitAttempt' | 'submitAriaLabel' | 'submitLoading'>;

export type CreationPanelBodyProps = {
  job: CreationPanelBodyJobProps;
  shell: CreationPanelBodyShellProps;
  upload: CreationPanelBodyUploadProps;
  dock: CreationPanelBodyDockProps;
  lane: CreationPanelBodyLaneProps;
  mention: CreationPanelBodyMentionProps;
  video: CreationPanelBodyVideoProps;
  prompt: CreationPanelBodyPromptProps;
  polish: CreationPanelBodyPolishProps;
  orchestration: CreationPanelBodyOrchestrationProps;
  generation: CreationPanelBodyGenerationProps;
  submit: CreationPanelBodySubmitProps;
  focusEdit?: CreationPanelBodyFocusEdit | null;
};

export function buildCreationPanelBodyProps(
  flat: CreationPanelBodyFlatProps & {
    focusEdit?: CreationPanelBodyFocusEdit | null;
  },
): CreationPanelBodyProps {
  const { focusEdit, ...rest } = flat;
  return {
    job: {
      showDockJobStatusBar: rest.showDockJobStatusBar,
      jobStreamStatus: rest.jobStreamStatus,
      streamBusy: rest.streamBusy,
      jobStatusSubtext: rest.jobStatusSubtext,
      pollingJobId: rest.pollingJobId,
      onCancelJob: rest.onCancelJob,
    },
    shell: {
      effectiveCollapsed: rest.effectiveCollapsed,
      inspirationApply: rest.inspirationApply,
      inspirationVars: rest.inspirationVars,
      setInspirationVars: rest.setInspirationVars,
      showModeTabs: rest.showModeTabs,
      variant: rest.variant,
      mode: rest.mode,
      setMode: rest.setMode,
      effectiveMode: rest.effectiveMode,
    },
    upload: {
      fileRef: rest.fileRef,
      uploadTarget: rest.uploadTarget,
      handleUpload: rest.handleUpload,
      openUpload: rest.openUpload,
      uploading: rest.uploading,
      uploadPreviews: rest.uploadPreviews,
      setUploadPreviewIndex: rest.setUploadPreviewIndex,
      setUploadPreviews: rest.setUploadPreviews,
      setAssetIds: rest.setAssetIds,
      assetIds: rest.assetIds,
      showStackUpload: rest.showStackUpload,
      showInlineUploadStack: rest.showInlineUploadStack,
      mentionUploadedAssets: rest.mentionUploadedAssets,
    },
    dock: {
      isDock: rest.isDock,
      isStudioDock: rest.isStudioDock,
      dockCompactLine: rest.dockCompactLine,
      dockShouldExpand: rest.dockShouldExpand,
      dockIconBtnClass: rest.dockIconBtnClass,
      dockIconBtnClassSm: rest.dockIconBtnClassSm,
      setDockFocused: rest.setDockFocused,
      setDockExpanded: rest.setDockExpanded,
    },
    lane: {
      creationLane: rest.creationLane,
      agentLaneAvailable: rest.agentLaneAvailable,
      handleCreationLaneChange: rest.handleCreationLaneChange,
      outputPrefMode: rest.outputPrefMode,
      handleOutputPrefModeChange: rest.handleOutputPrefModeChange,
    },
    mention: {
      canvasItems: rest.canvasItems,
      references: rest.references,
      mentionQuery: rest.mentionQuery,
      mentionOpen: rest.mentionOpen,
      insertMention: rest.insertMention,
      setMentionOpen: rest.setMentionOpen,
      setMentionQuery: rest.setMentionQuery,
      referenceChips: rest.referenceChips,
      handleRemoveReferenceChip: rest.handleRemoveReferenceChip,
      mentionedMasks: rest.mentionedMasks,
      syncMentionStateFromPrompt: rest.syncMentionStateFromPrompt,
    },
    video: {
      videoReferenceMode: rest.videoReferenceMode,
      videoReferences: rest.videoReferences,
      setVideoReferences: rest.setVideoReferences,
      smartMultiShots: rest.smartMultiShots,
      setSmartMultiShots: rest.setSmartMultiShots,
      firstLastMotionPrompt: rest.firstLastMotionPrompt,
      setFirstLastMotionPrompt: rest.setFirstLastMotionPrompt,
      uploadVideoReference: rest.uploadVideoReference,
      videoPickCandidates: rest.videoPickCandidates,
      videoPickCandidatesLoading: rest.videoPickCandidatesLoading,
      applyVideoPickCandidate: rest.applyVideoPickCandidate,
      videoUploading: rest.videoUploading,
      smartMultiDegraded: rest.smartMultiDegraded,
      handleVideoReferenceModeChange: rest.handleVideoReferenceModeChange,
      videoDurationSec: rest.videoDurationSec,
      setVideoDurationSec: rest.setVideoDurationSec,
      videoResolution: rest.videoResolution,
      setVideoResolution: rest.setVideoResolution,
      videoAutoMeta: rest.videoAutoMeta,
      videoRoutes: rest.videoRoutes,
    },
    prompt: {
      textareaRef: rest.textareaRef,
      prompt: rest.prompt,
      setPrompt: rest.setPrompt,
      submitOnEnter: rest.submitOnEnter,
      rotatingPlaceholder: rest.rotatingPlaceholder,
      rotatingText: rest.rotatingText,
      routeHint: rest.routeHint,
      sessionId: rest.sessionId,
    },
    polish: {
      enablePolish: rest.enablePolish,
      polishBusy: rest.polishBusy,
      polishHint: rest.polishHint,
      polishCandidates: rest.polishCandidates,
      polishCandidateIndex: rest.polishCandidateIndex,
      handlePolish: rest.handlePolish,
      cyclePolishCandidate: rest.cyclePolishCandidate,
      resetPolish: rest.resetPolish,
      reversing: rest.reversing,
      handlePromptReverse: rest.handlePromptReverse,
    },
    orchestration: {
      skillsEnabled: rest.skillsEnabled,
      skillPackages: rest.skillPackages,
      selectedSkillId: rest.selectedSkillId,
      skillInFlight: rest.skillInFlight,
      orchSkillBusy: rest.orchSkillBusy,
      orchSkillRun: rest.orchSkillRun,
      skillIdle: rest.skillIdle,
      setSelectedSkillId: rest.setSelectedSkillId,
      activeSkillId: rest.activeSkillId,
      selectedSkill: rest.selectedSkill,
      skillRun: rest.skillRun,
      skillBusy: rest.skillBusy,
      handleSubmit: rest.handleSubmit,
      cancelSkillRunAction: rest.cancelSkillRunAction,
      agentEnabled: rest.agentEnabled,
      homeDirectSubmit: rest.homeDirectSubmit,
      agentRun: rest.agentRun,
      agentBusy: rest.agentBusy,
      cancelAgentRunAction: rest.cancelAgentRunAction,
    },
    generation: {
      models: rest.models,
      modelId: rest.modelId,
      setModelId: rest.setModelId,
      count: rest.count,
      setCount: rest.setCount,
      resolution: rest.resolution,
      aspectRatio: rest.aspectRatio,
      setResolution: rest.setResolution,
      setAspectRatio: rest.setAspectRatio,
      isVideoModel: rest.isVideoModel,
      estimated: rest.estimated,
      user: rest.user,
    },
    submit: {
      readOnly: rest.readOnly,
      pending: rest.pending,
      handleSubmitAttempt: rest.handleSubmitAttempt,
      submitAriaLabel: rest.submitAriaLabel,
      submitLoading: rest.submitLoading,
    },
    focusEdit,
  };
}

export function flattenCreationPanelBodyProps(
  grouped: CreationPanelBodyProps,
): CreationPanelBodyFlatProps & { focusEdit?: CreationPanelBodyFocusEdit | null } {
  const { focusEdit, ...groups } = grouped;
  return {
    ...groups.job,
    ...groups.shell,
    ...groups.upload,
    ...groups.dock,
    ...groups.lane,
    ...groups.mention,
    ...groups.video,
    ...groups.prompt,
    ...groups.polish,
    ...groups.orchestration,
    ...groups.generation,
    ...groups.submit,
    focusEdit,
  };
}
