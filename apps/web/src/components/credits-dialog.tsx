"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { Button, GlassPanel } from "@aimarket/ui";
import {
  checkoutPackage,
  fetchPackages,
  fetchPaymentStatus,
} from "@/lib/api-client";
import type { CreditPackage } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";

interface CreditsDialogProps {
  open: boolean;
  onClose: () => void;
}

function formatPrice(cents: number) {
  return `¥${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export function CreditsDialog({ open, onClose }: CreditsDialogProps) {
  useAuth();
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [payProvider, setPayProvider] = useState<string>("mock");

  useEffect(() => {
    if (!open) return;
    setSuccess(null);
    Promise.all([fetchPackages(), fetchPaymentStatus()])
      .then(([pkgs, pay]) => {
        setPackages(pkgs);
        setPayProvider(pay.activeProvider);
      })
      .catch(() => setPackages([]))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  async function handleBuy(pkg: CreditPackage) {
    setBuying(pkg.id);
    try {
      const res = await checkoutPackage(pkg.id);
      if (res.provider === "stripe") {
        window.location.href = res.checkoutUrl;
        return;
      }
      window.location.href = res.checkoutUrl;
    } catch (err) {
      alert(err instanceof Error ? err.message : "创建订单失败");
    } finally {
      setBuying(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <GlassPanel className="relative w-full max-w-lg p-6">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-zinc-500 hover:text-white"
          aria-label="关闭"
        >
          <X className="size-5" />
        </button>
        <h2 className="text-xl font-semibold">充值积分</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Phase 5 Checkout · 当前支付通道：{payProvider}
          {payProvider === "mock" ? "（跳转收银台确认）" : "（Stripe）"}
        </p>

        {success ? (
          <div className="mt-6 flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-green-400">
            <Check className="size-5" />
            {success}
          </div>
        ) : null}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-6 animate-spin text-orange-400" />
          </div>
        ) : (
          <div className="mt-6 grid gap-3">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{pkg.name}</span>
                    {pkg.badge ? (
                      <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] text-orange-300">
                        {pkg.badge}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-zinc-500">
                    {pkg.credits.toLocaleString()} 积分
                  </p>
                </div>
                <Button
                  variant="primary"
                  disabled={buying === pkg.id}
                  onClick={() => void handleBuy(pkg)}
                >
                  {buying === pkg.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    formatPrice(pkg.price_cents)
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
