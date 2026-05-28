"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Sparkles } from "lucide-react";
import { fetchProviderStatus } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

/**
 * Studio 内画布右下角紧凑 chip：展示当前出图引擎状态。
 * - 真实 provider：绿色小圆点 + 模型名（如 wan2.6）
 * - Mock provider：琥珀色 ⚠ + Mock 提示
 * - hover 时显示完整 provider hint
 *
 * 这是从原横条 banner 改为右下角 chip 的轻量化版本：
 * 状态信息≠内容信息，不该独占一行 banner 抢画布空间。
 */
export function ProviderStatusChip({
  className = "",
}: {
  className?: string;
}) {
  const { user } = useAuth();
  const [hint, setHint] = useState<string | null>(null);
  const [usingMock, setUsingMock] = useState(true);
  const [model, setModel] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchProviderStatus()
      .then((p) => {
        setHint(p.hint ?? null);
        setUsingMock(p.usingMock ?? p.activeProvider === "mock");
        const match = (p.hint ?? "").match(/[（(]([^）)]+)[）)]?$/);
        setModel(match ? match[1] : (p.activeProvider ?? null));
      })
      .catch(() => setHint(null));
  }, [user]);

  if (!user || !hint) return null;

  return (
    <span
      title={hint}
      className={`pointer-events-auto inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] backdrop-blur ${
        usingMock
          ? "border-amber-500/30 bg-amber-500/10 text-amber-200/90"
          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200/90"
      } ${className}`}
    >
      {usingMock ? (
        <AlertCircle className="size-3" strokeWidth={1.6} />
      ) : (
        <Sparkles className="size-3" strokeWidth={1.6} />
      )}
      <span className="max-w-[120px] truncate">
        {model ?? (usingMock ? "Mock" : "Live")}
      </span>
    </span>
  );
}

/** 兼容旧名字的导出（即将下线） */
export const ProviderStatusBanner = ProviderStatusChip;
