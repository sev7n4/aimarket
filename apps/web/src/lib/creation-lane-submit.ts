import type { CreationLane } from "./creation-dock-prefs";

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
