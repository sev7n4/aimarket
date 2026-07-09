"use client";

import Link from "next/link";
import { workflowUrlForSession } from "@/lib/studio-navigation";
import type { ImageSession } from "@/lib/types";

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function WorkflowCard({ session }: { session: ImageSession }) {
  return (
    <Link
      href={workflowUrlForSession(session)}
      data-testid={`workflow-card-${session.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#141414] transition hover:border-white/20 hover:bg-[#181818]"
    >
      <div className="flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-950 text-xs text-zinc-600">
        无限画布
      </div>
      <div className="flex flex-col gap-1 p-3">
        <p className="truncate text-sm font-medium text-zinc-100 group-hover:text-white">
          {session.title || "未命名工作流"}
        </p>
        <p className="text-xs text-zinc-500">
          更新于 {formatUpdatedAt(session.updated_at)}
        </p>
      </div>
    </Link>
  );
}
