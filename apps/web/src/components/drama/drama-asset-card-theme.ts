import type { LucideIcon } from "lucide-react";
import { Clapperboard, FileText, MapPin, User } from "lucide-react";

export type DramaAssetCategory = "script" | "character" | "scene" | "shot";

export type DramaCategoryTheme = {
  label: string;
  accent: string;
  accentSoft: string;
  accentBorder: string;
  icon: LucideIcon;
};

export const DRAMA_CATEGORY_THEME: Record<DramaAssetCategory, DramaCategoryTheme> = {
  script: {
    label: "剧本",
    accent: "#8b5cf6",
    accentSoft: "rgba(139, 92, 246, 0.12)",
    accentBorder: "rgba(139, 92, 246, 0.35)",
    icon: FileText,
  },
  character: {
    label: "角色",
    accent: "#d946ef",
    accentSoft: "rgba(217, 70, 239, 0.12)",
    accentBorder: "rgba(217, 70, 239, 0.35)",
    icon: User,
  },
  scene: {
    label: "场景",
    accent: "#06b6d4",
    accentSoft: "rgba(6, 182, 212, 0.12)",
    accentBorder: "rgba(6, 182, 212, 0.35)",
    icon: MapPin,
  },
  shot: {
    label: "分镜",
    accent: "#6366f1",
    accentSoft: "rgba(99, 102, 241, 0.12)",
    accentBorder: "rgba(99, 102, 241, 0.35)",
    icon: Clapperboard,
  },
};
