"use client";

import { Bot, ImageIcon, Video } from "lucide-react";
import type { CreationLane } from "@/lib/creation-dock-prefs";

export const DOCK_PILL =
  "inline-flex max-w-[11rem] shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-zinc-300 transition hover:border-white/15 hover:bg-white/[0.07] hover:text-zinc-100";

export function laneIcon(lane: CreationLane) {
  if (lane === "agent") {
    return <Bot className="size-3.5 shrink-0 text-violet-400/90" />;
  }
  if (lane === "video") {
    return <Video className="size-3.5 shrink-0 text-sky-400/90" />;
  }
  return <ImageIcon className="size-3.5 shrink-0 text-orange-400/90" />;
}
