"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, GlassPanel } from "@aimarket/ui";
import { confirmOrder, fetchOrder } from "@/lib/api/billing";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";

export default function PayCheckoutPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const router = useRouter();
  const { user, loading, refreshUser } = useAuth();
  const [order, setOrder] = useState<{
    package_name: string;
    credits: number;
    price_cents: number;
    status: string;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user || !orderId) return;
    fetchOrder(orderId)
      .then(setOrder)
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  }, [loading, user, orderId]);

  async function handlePay() {
    if (!orderId) return;
    setPending(true);
    setError(null);
    try {
      const res = await confirmOrder(orderId);
      await refreshUser();
      router.push(`/pay/success?orderId=${orderId}&credits=${res.credits}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "支付失败");
    } finally {
      setPending(false);
    }
  }

  if (!loading && !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-black px-4 text-zinc-300">
        <GlassPanel className="p-6 text-center">
          <p>请先登录后再支付</p>
          <button
            type="button"
            className="mt-4 text-orange-400 hover:underline"
            onClick={() =>
              document.dispatchEvent(new Event("aimarket:open-login"))
            }
          >
            去登录
          </button>
        </GlassPanel>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-black px-4">
      <GlassPanel className="w-full max-w-md p-6">
        <h1 className="text-xl font-semibold">确认支付</h1>
        <p className="mt-1 text-sm text-zinc-500">Phase 5 Mock 收银台</p>

        {order ? (
          <div className="mt-6 space-y-2 text-sm">
            <p>
              套餐：<span className="text-white">{order.package_name}</span>
            </p>
            <p>
              积分：<span className="text-orange-300">{order.credits}</span>
            </p>
            <p>
              金额：
              <span className="text-white">
                ¥{(order.price_cents / 100).toFixed(2)}
              </span>
            </p>
            <p className="text-zinc-500">状态：{order.status}</p>
          </div>
        ) : (
          <p className="mt-6 text-sm text-zinc-500">加载订单…</p>
        )}

        {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}

        <Button
          variant="primary"
          className="mt-6 w-full"
          disabled={pending || order?.status === "paid"}
          onClick={() => void handlePay()}
        >
          {order?.status === "paid"
            ? "已支付"
            : pending
              ? "处理中…"
              : "确认支付（模拟）"}
        </Button>
        <Link
          href="/studio"
          className="mt-4 block text-center text-xs text-zinc-500 hover:text-zinc-300"
        >
          取消并返回
        </Link>
      </GlassPanel>
    </div>
  );
}
