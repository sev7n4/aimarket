"use client";

import { RecentSessionsList } from "@/components/recent-sessions-list";
import { useRecentSessions } from "@/hooks/use-recent-sessions";

/** P2-4：移动抽屉展示最近会话 */
export function HomeRecentSessions({ className = "" }: { className?: string }) {
  const { sessions, hasUser } = useRecentSessions(3);

  if (!hasUser || sessions.length === 0) return null;

  return <RecentSessionsList sessions={sessions} className={className} />;
}
