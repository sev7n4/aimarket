"use client";

import type { AgentSkillPublic } from "@/lib/types";
import { DRAMA_SKILL_ID } from "@/lib/drama-submit-routing";

/** 历史 Dock 存盘别名；新逻辑统一为 Skill `ecommerce-set-v1` */
export const ECOMMERCE_DOCK_SKILL_ID = "__ecommerce__";
export const ECOMMERCE_SET_SKILL_ID = "ecommerce-set-v1";
/** AI 短剧（独立 /drama API，借鉴 RHTV Anchor First） */
export { DRAMA_SKILL_ID };

export function normalizeDockSkillId(id: string | null): string | null {
  if (!id) return null;
  if (id === ECOMMERCE_DOCK_SKILL_ID) return ECOMMERCE_SET_SKILL_ID;
  return id;
}
export interface DockSkillOption {
  id: string;
  name: string;
  description?: string;
  badge?: string;
}
export function buildDockSkillOptions(
  skills: AgentSkillPublic[],
  _includeEcommerce?: boolean,
): DockSkillOption[] {
  const dramaOption: DockSkillOption = {
    id: DRAMA_SKILL_ID,
    name: "AI 短剧",
    description: "多角色对白短剧，Anchor First 角色定稿 + 分镜 + 口型同步",
    badge: "new",
  };
  const ordered = [...skills].sort((a, b) => {
    if (a.id === ECOMMERCE_SET_SKILL_ID) return -1;
    if (b.id === ECOMMERCE_SET_SKILL_ID) return 1;
    if (a.id === "commerce-promo-v1") return -1;
    if (b.id === "commerce-promo-v1") return 1;
    if (a.id === "ecommerce-taobao-launch-v1") return -1;
    if (b.id === "ecommerce-taobao-launch-v1") return 1;
    return 0;
  });
  return [
    dramaOption,
    ...ordered.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      badge:
        s.id === ECOMMERCE_SET_SKILL_ID
          ? ("hot" as const)
          : s.id === "commerce-promo-v1"
            ? ("new" as const)
            : s.id === "ecommerce-taobao-launch-v1"
              ? ("new" as const)
              : undefined,
    })),
  ];
}