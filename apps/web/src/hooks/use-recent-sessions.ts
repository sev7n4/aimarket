"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { listSessions } from "@/lib/api-client";
import type { ImageSession } from "@/lib/types";

export function useRecentSessions(limit = 3) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ImageSession[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setSessions([]);
      return;
    }
    setLoading(true);
    void listSessions(limit)
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [user, limit]);

  return { sessions, loading, hasUser: !!user };
}
