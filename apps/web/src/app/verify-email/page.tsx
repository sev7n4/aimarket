"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button, GlassPanel } from "@aimarket/ui";
import { resendVerificationEmail, verifyEmail } from "@/lib/api/auth";
import { useAuth } from "@/lib/auth-context";
import { BrandLogo } from "@/components/brand-logo";

type Status = "loading" | "success" | "error";

function VerifyEmailBody() {
  const params = useSearchParams();
  const token = params.get("token");
  const { refreshUser } = useAuth();
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("验证链接无效，请从邮件中重新打开或申请重发验证邮件。");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await verifyEmail(token);
        if (cancelled) return;
        await refreshUser();
        setStatus("success");
        setMessage(res.message);
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "验证失败");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, refreshUser]);

  async function handleResend() {
    setResending(true);
    try {
      const res = await resendVerificationEmail();
      setMessage(res.message);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "发送失败");
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
      <GlassPanel className="w-full max-w-md p-8 text-center">
        <div className="mb-6 flex justify-center">
          <BrandLogo variant="lockup" markSize="md" />
        </div>

        {status === "loading" && (
          <div className="flex flex-col items-center gap-3 text-zinc-400">
            <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
            <p>正在验证邮箱…</p>
          </div>
        )}

        {status !== "loading" && (
          <>
            <h1 className="text-lg font-semibold text-white">
              {status === "success" ? "邮箱验证成功" : "验证未完成"}
            </h1>
            <p className="mt-3 text-sm text-zinc-400">{message}</p>
            <div className="mt-6 flex flex-col gap-2">
              <Link href="/studio">
                <Button className="w-full">进入 Studio</Button>
              </Link>
              {status === "error" && (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  disabled={resending}
                  onClick={() => void handleResend()}
                >
                  {resending ? "发送中…" : "重新发送验证邮件"}
                </Button>
              )}
              <Link
                href="/"
                className="text-sm text-zinc-500 hover:text-zinc-300"
              >
                返回首页
              </Link>
            </div>
          </>
        )}
      </GlassPanel>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-4 text-zinc-400">
          加载中…
        </main>
      }
    >
      <VerifyEmailBody />
    </Suspense>
  );
}
