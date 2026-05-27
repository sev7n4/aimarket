"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { listSessions } from "@/lib/api-client";
import { studioUrlForSession } from "@/lib/studio-navigation";
import type { ImageSession } from "@/lib/types";

/** P2-4：首页/移动抽屉展示最近会话 */
export function HomeRecentSessions({ className = "" }: { className?: string }) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ImageSession[]>([]);

  useEffect(() => {
    if (!user) return;
    void listSessions(3).then(setSessions).catch(() => setSessions([]));
  }, [user]);

  if (!user || sessions.length === 0) return null;

  return (
    <div className={className}>
      <p className="mb-2 text-xs text-zinc-600">继续编辑</p>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {sessions.map((s) => (
          <Link
            key={s.id}
            href={studioUrlForSession({
              id: s.id,
              mode: s.mode,
              kind: s.kind,
            })}
            className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400 transition hover:border-orange-500/30 hover:text-zinc-200"
          >
            {s.title && s.title !== "未命名" ? s.title : "未命名画布"}
          </Link>
        ))}
      </div>
    </div>
  );
}
