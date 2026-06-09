"use client";

import Link from "next/link";
import { studioUrlForSession } from "@/lib/studio-navigation";
import type { ImageSession } from "@/lib/types";

function sessionLabel(title: string | null | undefined) {
  return title && title !== "未命名" ? title : "未命名画布";
}

interface RecentSessionsListProps {
  sessions: ImageSession[];
  variant?: "chips" | "list";
  onNavigate?: () => void;
  showHeading?: boolean;
  className?: string;
}

export function RecentSessionsList({
  sessions,
  variant = "chips",
  onNavigate,
  showHeading = true,
  className = "",
}: RecentSessionsListProps) {
  if (sessions.length === 0) return null;

  if (variant === "list") {
    return (
      <ul className={`space-y-0.5 ${className}`}>
        {sessions.map((s) => (
          <li key={s.id}>
            <Link
              href={studioUrlForSession({
                id: s.id,
                mode: s.mode,
                kind: s.kind,
              })}
              onClick={onNavigate}
              className="block rounded-lg px-2.5 py-2 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
            >
              <span className="line-clamp-1">{sessionLabel(s.title)}</span>
              <span className="text-[10px] text-zinc-600">画布 · {s.mode}</span>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className={className}>
      {showHeading ? (
        <p className="mb-2 text-xs text-zinc-600">继续编辑</p>
      ) : null}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {sessions.map((s) => (
          <Link
            key={s.id}
            href={studioUrlForSession({
              id: s.id,
              mode: s.mode,
              kind: s.kind,
            })}
            onClick={onNavigate}
            className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400 transition hover:border-orange-500/30 hover:text-zinc-200"
          >
            {sessionLabel(s.title)}
          </Link>
        ))}
      </div>
    </div>
  );
}
