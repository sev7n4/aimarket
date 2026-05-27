"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { GlassPanel } from "@aimarket/ui";
import { Check } from "lucide-react";

function SuccessContent() {
  const params = useSearchParams();
  const credits = params.get("credits");
  const orderId = params.get("orderId");

  return (
    <GlassPanel className="w-full max-w-md p-8 text-center">
      <Check className="mx-auto size-12 text-green-400" />
      <h1 className="mt-4 text-xl font-semibold">支付成功</h1>
      {credits ? (
        <p className="mt-2 text-zinc-400">已充值 {credits} 积分</p>
      ) : null}
      {orderId ? (
        <p className="mt-1 text-xs text-zinc-600">订单 {orderId}</p>
      ) : null}
      <Link
        href="/studio"
        className="mt-6 inline-block rounded-full bg-orange-500 px-6 py-2 text-sm font-medium text-white hover:bg-orange-600"
      >
        返回创作页
      </Link>
    </GlassPanel>
  );
}

export default function PaySuccessPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-black px-4">
      <Suspense fallback={<p className="text-zinc-500">加载中…</p>}>
        <SuccessContent />
      </Suspense>
    </div>
  );
}
