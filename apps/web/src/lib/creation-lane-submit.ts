import type { CreationLane } from "./creation-dock-prefs";
import {
  enhanceSubmitPath,
  type IntentAnalysis,
  type IntentRouterInput,
} from "./intent-router";
import type { LightSource } from "@/components/lighting-editor";

export interface ReferenceImageSources {
  assetIds: string[];
  mentionedAssetIds: string[];
  selectedRefIds: string[];
}

export function hasReferenceImages(sources: ReferenceImageSources): boolean {
  return (
    sources.assetIds.length > 0 ||
    sources.mentionedAssetIds.length > 0 ||
    sources.selectedRefIds.length > 0
  );
}

export function normalizeReferenceOutputIds(
  selectedRefIds: string[],
): string[] | undefined {
  return selectedRefIds.length > 0 ? selectedRefIds : undefined;
}

export interface OrchestrationDispatchContext {
  creationLane: CreationLane;
  activeSkillId: string | null;
  focusEditActive: boolean;
  mentionedMasksCount: number;
  submitVideo: boolean;
  hasReferenceImages: boolean;
  /** AI 短剧内建参考图，非用户手动选图 */
  dramaSkillActive?: boolean;
}

/** Studio orchestration 是否接管本次提交（Agent / Skill） */
export function shouldOrchestrationHandleSubmit(
  ctx: OrchestrationDispatchContext,
): boolean {
  if (ctx.submitVideo) return false;
  if (ctx.focusEditActive || ctx.mentionedMasksCount > 0) return false;
  if (ctx.hasReferenceImages && !ctx.dramaSkillActive) return false;

  if (ctx.activeSkillId) return true;
  if (ctx.creationLane === "agent") return true;
  return false;
}

export interface DirectSubmitContext {
  studioOrchestrationActive: boolean;
  skillsEnabled: boolean;
  agentEnabled: boolean;
  isDock: boolean;
  creationLane: CreationLane;
  activeSkillId: string | null;
  focusEditActive: boolean;
  mentionedMasksCount: number;
  submitVideo: boolean;
  submitEcommerce: boolean;
  hasReferenceImages: boolean;
  /** 灯光控制光源数据，传递给后端 prompt 编码 */
  lights?: LightSource[];
}

export function shouldUseSkillSubmit(ctx: DirectSubmitContext): boolean {
  if (ctx.studioOrchestrationActive) return false;
  if (!ctx.skillsEnabled || !ctx.activeSkillId) return false;
  if (ctx.focusEditActive || ctx.mentionedMasksCount > 0) return false;
  if (ctx.submitVideo) return false;
  if (ctx.hasReferenceImages) return false;
  return true;
}

export function shouldUseAgentSubmit(ctx: DirectSubmitContext): boolean {
  if (ctx.studioOrchestrationActive) return false;
  if (!ctx.agentEnabled) return false;
  if (ctx.hasReferenceImages) return false;
  if (ctx.activeSkillId) return false;
  if (ctx.focusEditActive || ctx.mentionedMasksCount > 0) return false;
  if (ctx.submitVideo || ctx.submitEcommerce) return false;
  if (!ctx.isDock) return false;
  return ctx.creationLane === "agent";
}

export type SubmitPath =
  | "orchestration"
  | "skill"
  | "agent"
  | "focus-edit"
  | "image-or-video";

export interface ResolveSubmitPathInput extends DirectSubmitContext {
  orchestrationDispatchWouldHandle: boolean;
  focusEditActive: boolean;
}

export function resolveSubmitPath(
  ctx: ResolveSubmitPathInput,
): SubmitPath {
  if (ctx.orchestrationDispatchWouldHandle) return "orchestration";
  if (shouldUseSkillSubmit(ctx)) return "skill";
  if (shouldUseAgentSubmit(ctx)) return "agent";
  if (ctx.focusEditActive) return "focus-edit";
  return "image-or-video";
}

export interface BuildOrchestrationDispatchInput {
  creationLane: CreationLane;
  activeSkillId: string | null;
  focusEditActive: boolean;
  mentionedMasksCount: number;
  submitVideo: boolean;
  referenceImageSources: ReferenceImageSources;
  dramaSkillActive?: boolean;
}

export function buildOrchestrationDispatchContext(
  input: BuildOrchestrationDispatchInput,
): OrchestrationDispatchContext {
  return {
    creationLane: input.creationLane,
    activeSkillId: input.activeSkillId,
    focusEditActive: input.focusEditActive,
    mentionedMasksCount: input.mentionedMasksCount,
    submitVideo: input.submitVideo,
    hasReferenceImages: hasReferenceImages(input.referenceImageSources),
    dramaSkillActive: input.dramaSkillActive,
  };
}

export interface BuildDirectSubmitInput {
  studioOrchestrationActive: boolean;
  skillsEnabled: boolean;
  agentEnabled: boolean;
  isDock: boolean;
  creationLane: CreationLane;
  activeSkillId: string | null;
  focusEditActive: boolean;
  mentionedMasksCount: number;
  submitVideo: boolean;
  submitEcommerce: boolean;
  referenceImageSources: ReferenceImageSources;
  /** 灯光控制光源数据，传递给后端 prompt 编码 */
  lights?: LightSource[];
}

export function buildDirectSubmitContext(
  input: BuildDirectSubmitInput,
): DirectSubmitContext {
  return {
    studioOrchestrationActive: input.studioOrchestrationActive,
    skillsEnabled: input.skillsEnabled,
    agentEnabled: input.agentEnabled,
    isDock: input.isDock,
    creationLane: input.creationLane,
    activeSkillId: input.activeSkillId,
    focusEditActive: input.focusEditActive,
    mentionedMasksCount: input.mentionedMasksCount,
    submitVideo: input.submitVideo,
    submitEcommerce: input.submitEcommerce,
    hasReferenceImages: hasReferenceImages(input.referenceImageSources),
    lights: input.lights,
  };
}

export interface ResolveCreationSubmitPathInput {
  direct: DirectSubmitContext;
  /** Studio Provider 存在且本次应由编排接管时为 true */
  orchestrationDispatchWouldHandle: boolean;
}

/** 创作 Dock 提交路径唯一入口（CreationPanel / 测试共用） */
export function resolveCreationSubmitPath(
  input: ResolveCreationSubmitPathInput,
): SubmitPath {
  return resolveSubmitPath({
    ...input.direct,
    orchestrationDispatchWouldHandle: input.orchestrationDispatchWouldHandle,
    focusEditActive: input.direct.focusEditActive,
  });
}

/** 路径决策输入（Studio Dock / Home Dock 共用） */
export type CreationSubmitPathContext = {
  studioOrchestrationActive: boolean;
  skillsEnabled: boolean;
  agentEnabled: boolean;
  isDock: boolean;
  creationLane: CreationLane;
  activeSkillId: string | null;
  focusEditActive: boolean;
  mentionedMasksCount: number;
  submitVideo: boolean;
  submitEcommerce: boolean;
  referenceImageSources: ReferenceImageSources;
  dramaSkillActive?: boolean;
};

export function resolveCreationSubmitPathFromContext(
  ctx: CreationSubmitPathContext,
): SubmitPath {
  const directSubmitContext = buildDirectSubmitContext({
    studioOrchestrationActive: ctx.studioOrchestrationActive,
    skillsEnabled: ctx.skillsEnabled,
    agentEnabled: ctx.agentEnabled,
    isDock: ctx.isDock,
    creationLane: ctx.creationLane,
    activeSkillId: ctx.activeSkillId,
    focusEditActive: ctx.focusEditActive,
    mentionedMasksCount: ctx.mentionedMasksCount,
    submitVideo: ctx.submitVideo,
    submitEcommerce: ctx.submitEcommerce,
    referenceImageSources: ctx.referenceImageSources,
  });
  const orchestrationDispatchWouldHandle =
    ctx.studioOrchestrationActive &&
    shouldOrchestrationHandleSubmit(
      buildOrchestrationDispatchContext({
        creationLane: ctx.creationLane,
        activeSkillId: ctx.activeSkillId,
        focusEditActive: ctx.focusEditActive,
        mentionedMasksCount: ctx.mentionedMasksCount,
        submitVideo: ctx.submitVideo,
        referenceImageSources: ctx.referenceImageSources,
        dramaSkillActive: ctx.dramaSkillActive,
      }),
    );
  return resolveCreationSubmitPath({
    direct: directSubmitContext,
    orchestrationDispatchWouldHandle,
  });
}

// ─── 意图增强路由 ────────────────────────────────────────────────────────────

/** 意图增强的提交路径输入 */
export interface ResolveCreationSubmitPathWithIntentInput {
  direct: DirectSubmitContext;
  orchestrationDispatchWouldHandle: boolean;
  /** 用户输入的 prompt */
  prompt: string;
  /** 当前是否选中了画布元素 */
  hasSelectedCanvasItem?: boolean;
}

/**
 * 创作 Dock 意图增强提交路径入口
 *
 * 相比 resolveCreationSubmitPath 纯布尔路由，此函数额外分析用户 prompt 意图，
 * 支持跨模态复合意图（如"编辑这张图再生成视频"）的路由决策。
 * 当意图分析置信度高或检测到复合意图时，覆盖布尔守卫结果。
 */
export function resolveCreationSubmitPathWithIntent(
  input: ResolveCreationSubmitPathWithIntentInput,
): { path: SubmitPath; analysis: IntentAnalysis } {
  const { direct, orchestrationDispatchWouldHandle, prompt, hasSelectedCanvasItem } = input;

  const intentInput: IntentRouterInput = {
    prompt,
    creationLane: direct.creationLane,
    activeSkillId: direct.activeSkillId,
    focusEditActive: direct.focusEditActive,
    mentionedMasksCount: direct.mentionedMasksCount,
    submitVideo: direct.submitVideo,
    hasReferenceImages: direct.hasReferenceImages,
    hasSelectedCanvasItem: hasSelectedCanvasItem ?? false,
    skillsEnabled: direct.skillsEnabled,
    agentEnabled: direct.agentEnabled,
    isDock: direct.isDock,
  };

  const booleanPath = resolveCreationSubmitPath({
    direct,
    orchestrationDispatchWouldHandle,
  });

  const { path, analysis } = enhanceSubmitPath(intentInput, booleanPath);

  // 编排接管优先级不变：意图路由不应跳过编排
  if (orchestrationDispatchWouldHandle && path !== "orchestration") {
    const orchestrationOverride: SubmitPath = "orchestration";
    return { path: orchestrationOverride, analysis };
  }

  return { path, analysis };
}
