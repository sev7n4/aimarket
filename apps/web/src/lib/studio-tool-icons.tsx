"use client";

import {
  ArrowUpToLine,
  Brush,
  Copy,
  Crop,
  Crosshair,
  Eraser,
  Grid3X3,
  Layers,
  Maximize2,
  Scissors,
  Sparkles,
  Type,
  Wand2,
  type LucideIcon,
} from "lucide-react";

export const STUDIO_TOOL_ICONS: Record<string, LucideIcon> = {
  variation: Copy,
  expand: Maximize2,
  erase: Eraser,
  cutout: Scissors,
  inpaint: Brush,
  "focus-edit": Crosshair,
  text: Type,
  upscale: ArrowUpToLine,
  enhance: Sparkles,
  blend: Layers,
  crop: Crop,
  "grid-split": Grid3X3,
};

export function studioToolIcon(
  toolId: string,
  fallback: LucideIcon = Sparkles,
): LucideIcon {
  return STUDIO_TOOL_ICONS[toolId] ?? fallback;
}

/** 精修工具网格默认 fallback */
export const STUDIO_TOOL_GRID_ICON_FALLBACK = Wand2;
