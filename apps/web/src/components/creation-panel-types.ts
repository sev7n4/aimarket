"use client";

import type { CreationMode } from "@aimarket/ui";
import type { CanvasItem, CanvasMaskSelection, PendingBatchLineage } from "@/lib/canvas-tools";
import type { PendingAsset } from "@/lib/pending-assets";
import type { StudioInspirationApply } from "@/lib/inspiration-studio";
import type { StudioDockMode } from "@/lib/studio-dock-state";
import type { FocusEditIntent, FocusPointChip } from "@/lib/focus-edit";

export interface CreationPanelProps {
  initialMode?: CreationMode;
  initialPrompt?: string;
  compact?: boolean;
  variant?: "default" | "dock" | "studio-dock";
  mode?: CreationMode;
  onModeChange?: (mode: CreationMode) => void;
  showModeTabs?: boolean;
  sessionId?: string;
  onAuthRequired?: (hint?: string) => void;
  /** 首页：空提交等轻提示（不触发登录） */
  onInteractionHint?: (message: string) => void;
  /** 首页 dock：Enter 直接提交（Shift+Enter 换行） */
  submitOnEnter?: boolean;
  onJobStarted?: (jobId: string, lineage?: PendingBatchLineage) => void;
  /** Studio 父级 SSE/轮询推送的状态（对标椒图进度感） */
  jobStreamStatus?: string | null;
  /** 当前正在运行的任务ID，用于取消任务 */
  pollingJobId?: string | null;
  /** 取消任务的回调 */
  onCancelJob?: () => void;
  jobElapsedMs?: number;
  queueAhead?: number | null;
  navigateOnSubmit?: boolean;
  /** 首页：左侧虚线上传位 */
  leadingUpload?: boolean;
  /** 首页：Prompt 润色按钮 */
  enablePolish?: boolean;
  /** 登录后首页直接提交并跳转 Studio */
  homeDirectSubmit?: boolean;
  /** Studio：从首页带入 prompt 后自动提交一次（URL submit=1） */
  autoSubmitOnce?: boolean;
  /** 轮播「试试输入：…」占位（对标椒图） */
  rotatingPlaceholder?: boolean;
  /** 团队空间只读：禁止在本会话生成 */
  readOnly?: boolean;
  /** Studio 恢复未登录时上传的附件（含预览 URL） */
  restoredAssets?: PendingAsset[];
  /** Studio 灵感同款灌入 */
  inspirationApply?: StudioInspirationApply | null;
  /** 输入区左侧"灵感"圆按钮点击回调（首页用来展开扇形面板） */
  onInspirationClick?: () => void;
  /** 加载过灵感套图后，灵感按钮显示缩略图 */
  inspirationCoverUrl?: string;
  /** 灵感面板当前是否展开（控制按钮高亮态） */
  inspirationActive?: boolean;
  /** 受控 prompt（Studio 工作台与 CreationPanel 同步） */
  prompt?: string;
  /** prompt 变化回调 */
  onPromptChange?: (prompt: string) => void;
  /**
   * 折叠态（用于 Studio 「最大化画布」）：仅保留 textarea + 灵感/上传 + 发送按钮，
   * 隐藏模型/数量/分辨率/Agent 计划预览等高级控件，把 dock 高度收缩到 ~56px。
   */
  collapsed?: boolean;
  /** 首页原位：默认展开创作台（多行 + 工具栏） */
  initialDockExpanded?: boolean;
  /** 首页滚出视口后：强制单行收缩（点击/聚焦可再展开） */
  dockLineOnly?: boolean;
  /** Studio Dock 三态（studio-dock variant，专注画布按钮） */
  onDockModeChange?: (mode: StudioDockMode) => void;
  /**
   * 画布上的图片（用于 @ 上下文引用候选项）。
   * 仿 Cursor 的 @ 体验，工作台输入框 @ 后弹 popover 列出画布所有图片，
   * 选中后插入 chip token 并把对应 assetId/outputId 一同提交。
   */
  canvasItems?: CanvasItem[];
  /**
   * 画布工具浮层触发的 @ 当前图请求。
   * key 每次递增，避免同一张图连续 @ 时被 React 依赖去重。
   */
  mentionItemRequest?: {
    key: number;
    item: CanvasItem;
    promptSuffix?: string;
    maskSelection?: CanvasMaskSelection;
  } | null;
  /** 焦点编辑：Chip 列表与 intent，提交时走 focus-edit/run */
  focusEdit?: {
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
    onCancel: () => void;
  } | null;
  onFocusEditSubmit?: (args: {
    prompt: string;
    intent: FocusEditIntent;
    points: FocusPointChip[];
    item: CanvasItem;
  }) => Promise<string>;
  /** 上传完成后把图片添加到画布素材区 */
  onUploadToCanvas?: (assetId: string, url: string, thumbUrl?: string) => void;
  /** Studio：当前选中的画布项，图片/视频车道自动作参考 */
  selectedCanvasItem?: CanvasItem | null;
  /** Studio：取消画布点选参考（chip × 或等价操作） */
  onClearCanvasSelection?: () => void;
  /** Studio：走 Agent Run 编排（/agent/runs） */
  agentOrchestration?: boolean;
  /** Studio：展示长 Skill 套餐（/agent/skills） */
  agentSkills?: boolean;
  /** Agent Run 结束（成功/失败/取消）后回调 */
  onAgentRunComplete?: () => void;
}

export type CreationPanelHandle = {
  submit: () => void;
};
