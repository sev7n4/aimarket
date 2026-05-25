"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Sparkles } from "lucide-react";
import { fetchProviderStatus } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

/** Studio 内展示当前出图引擎（Mock / OpenAI） */
export function ProviderStatusBanner() {
  const { user } = useAuth();
  const [hint, setHint] = useState<string | null>(null);
  const [usingMock, setUsingMock] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchProviderStatus()
      .then((p) => {
        setHint(p.hint ?? null);
        setUsingMock(p.usingMock ?? p.activeProvider === "mock");
      })
      .catch(() => setHint(null));
  }, [user]);

  if (!user || !hint) return null;

  return (
    <div
      className={`mb-2 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
        usingMock
          ? "border-amber-500/25 bg-amber-500/10 text-amber-200/90"
          : "border-emerald-500/25 bg-emerald-500/10 text-emerald-200/90"
      }`}
    >
      {usingMock ? (
        <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
      ) : (
        <Sparkles className="mt-0.5 size-3.5 shrink-0" />
      )}
      <span>{hint}</span>
    </div>
  );
}
