"use client";

import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { InviteDialog } from "@/components/invite-dialog";
import { useAuth } from "@/lib/auth-context";
import { GlassPanel } from "@aimarket/ui";
import Link from "next/link";

export default function InvitePage() {
  const { user, loading } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (user) setDialogOpen(true);
  }, [user]);

  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main className="mx-auto max-w-lg px-4 py-16">
        <GlassPanel className="p-8 text-center">
          <h1 className="text-2xl font-bold">邀请有礼</h1>
          <p className="mt-4 text-sm leading-relaxed text-zinc-400">
            分享你的专属邀请码，好友注册成功后，双方各获得 100 积分奖励。
          </p>
          {loading ? null : user ? (
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="mt-8 rounded-full bg-gradient-to-r from-orange-500 to-purple-600 px-6 py-2.5 text-sm font-medium"
            >
              查看我的邀请码
            </button>
          ) : (
            <p className="mt-8 text-sm text-zinc-500">
              请先{" "}
              <button
                type="button"
                className="text-orange-400 hover:underline"
                onClick={() =>
                  document.dispatchEvent(new CustomEvent("aimarket:open-login"))
                }
              >
                登录
              </button>{" "}
              后查看邀请码
            </p>
          )}
          <Link
            href="/"
            className="mt-6 inline-block text-sm text-zinc-500 hover:text-zinc-300"
          >
            ← 返回首页
          </Link>
        </GlassPanel>
      </main>
      <SiteFooter />
      <InviteDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
