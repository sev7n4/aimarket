"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { GlassPanel } from "@aimarket/ui";

function PayCancelContent() {
  const orderId = useSearchParams().get("orderId");

  return (
    <GlassPanel className="w-full max-w-md p-8 text-center">
      <h1 className="text-xl font-semibold">支付已取消</h1>
      {orderId ? (
        <p className="mt-2 text-xs text-zinc-500">订单 {orderId}</p>
      ) : null}
      <Link
        href="/studio"
        className="mt-6 inline-block text-sm text-orange-400 hover:underline"
      >
        返回工作台
      </Link>
    </GlassPanel>
  );
}

export default function PayCancelPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-black px-4">
      <Suspense fallback={<p className="text-zinc-500">加载中…</p>}>
        <PayCancelContent />
      </Suspense>
    </div>
  );
}
