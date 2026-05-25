"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { GlassPanel, Button } from "@aimarket/ui";
import { joinWorkspace } from "@/lib/api-client";
import { setActiveWorkspaceId } from "@/lib/active-workspace";
import { useAuth } from "@/lib/auth-context";
import { LoginDialog } from "@/components/login-dialog";

function JoinContent() {
  const router = useRouter();
  const params = useSearchParams();
  const code = params.get("code") ?? "";
  const { user, loading } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!code || loading) return;
    if (!user) {
      setMessage("请先登录后再加入工作区");
      return;
    }
    void joinWorkspace(code)
      .then((data) => {
        setActiveWorkspaceId(data.workspaceId);
        setStatus("ok");
        setMessage(
          data.alreadyMember
            ? `你已是「${data.workspaceName}」的成员`
            : `已加入「${data.workspaceName}」`,
        );
        setTimeout(() => router.push("/studio"), 2000);
      })
      .catch((e) => {
        setStatus("error");
        setMessage(e instanceof Error ? e.message : "加入失败");
      });
  }, [code, user, loading, router]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-black px-4">
      <GlassPanel className="w-full max-w-md p-8 text-center text-zinc-200">
        <h1 className="text-xl font-semibold">加入工作区</h1>
        {code ? (
          <p className="mt-2 text-sm text-zinc-500">邀请码：{code}</p>
        ) : (
          <p className="mt-2 text-sm text-red-400">缺少邀请码参数</p>
        )}
        <p
          className={`mt-4 text-sm ${
            status === "error" ? "text-red-400" : "text-zinc-400"
          }`}
        >
          {message || (loading ? "加载中…" : "处理中…")}
        </p>
        {!user && !loading ? (
          <Button
            type="button"
            variant="primary"
            className="mt-6 w-full"
            onClick={() => setLoginOpen(true)}
          >
            登录后加入
          </Button>
        ) : null}
        <Link
          href="/"
          className="mt-4 inline-block text-sm text-zinc-500 hover:text-white"
        >
          返回首页
        </Link>
      </GlassPanel>
      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-black text-zinc-500">
          加载中…
        </div>
      }
    >
      <JoinContent />
    </Suspense>
  );
}
