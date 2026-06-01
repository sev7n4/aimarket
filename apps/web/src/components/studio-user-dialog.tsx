"use client";

import { useEffect, useState } from "react";
import { LogOut, Coins, CalendarCheck, Gift, X } from "lucide-react";
import { Button } from "@aimarket/ui";
import { useAuth } from "@/lib/auth-context";
import { fetchSignStatus, signIn } from "@/lib/api-client";
import type { ApiUser } from "@/lib/types";

interface StudioUserDialogProps {
  open: boolean;
  onClose: () => void;
  onLogin: () => void;
  onOpenCredits: () => void;
  onOpenInvite?: () => void;
}

function formatJoined(createdAt?: string) {
  if (!createdAt) return null;
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function StudioUserDialog({
  open,
  onClose,
  onLogin,
  onOpenCredits,
  onOpenInvite,
}: StudioUserDialogProps) {
  const { user, loading, logout, refreshUser } = useAuth();
  const [signedToday, setSignedToday] = useState(true);
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    fetchSignStatus()
      .then((s) => setSignedToday(s.signedToday))
      .catch(() => setSignedToday(true));
  }, [open, user]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[65] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="关闭"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-user-title"
        className="relative w-full max-w-sm rounded-t-2xl border border-white/10 bg-[#0b0b0b] p-5 shadow-2xl sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="studio-user-title" className="text-base font-semibold text-white">
            账户
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/10 hover:text-white"
            aria-label="关闭"
          >
            <X className="size-4" />
          </button>
        </div>

        {!loading && !user ? (
          <div className="space-y-4">
            <p className="text-sm text-zinc-500">登录后可同步积分、工作区与创作记录。</p>
            <Button type="button" variant="primary" className="w-full" onClick={onLogin}>
              登录 / 注册
            </Button>
          </div>
        ) : user ? (
          <LoggedInBody
            user={user}
            signedToday={signedToday}
            signing={signing}
            onSignIn={async () => {
              setSigning(true);
              try {
                await signIn();
                await refreshUser();
                setSignedToday(true);
              } finally {
                setSigning(false);
              }
            }}
            onOpenCredits={() => {
              onClose();
              onOpenCredits();
            }}
            onOpenInvite={
              onOpenInvite ?
                () => {
                  onClose();
                  onOpenInvite();
                }
              : undefined
            }
            onLogout={() => {
              logout();
              onClose();
            }}
          />
        ) : (
          <p className="text-sm text-zinc-500">加载中…</p>
        )}
      </div>
    </div>
  );
}

function LoggedInBody({
  user,
  signedToday,
  signing,
  onSignIn,
  onOpenCredits,
  onOpenInvite,
  onLogout,
}: {
  user: ApiUser;
  signedToday: boolean;
  signing: boolean;
  onSignIn: () => void | Promise<void>;
  onOpenCredits: () => void;
  onOpenInvite?: () => void;
  onLogout: () => void;
}) {
  const joined = formatJoined(user.created_at);
  const initial = user.email[0]?.toUpperCase() ?? "U";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/40 p-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-purple-600 text-sm font-bold text-white">
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-zinc-100">{user.email}</p>
          {joined ? (
            <p className="mt-0.5 text-[11px] text-zinc-600">加入于 {joined}</p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-orange-500/20 bg-orange-500/10 px-3 py-2.5">
        <div className="flex items-center gap-2 text-sm text-orange-200">
          <Coins className="size-4 shrink-0" />
          <span>{user.credits} 积分</span>
        </div>
        <button
          type="button"
          onClick={onOpenCredits}
          className="text-xs font-medium text-orange-300 hover:text-orange-200"
        >
          充值
        </button>
      </div>

      <button
        type="button"
        disabled={signedToday || signing}
        onClick={() => void onSignIn()}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-sm text-zinc-300 transition hover:bg-white/5 disabled:opacity-50"
      >
        <CalendarCheck className="size-4" />
        {signedToday ? "今日已签到" : signing ? "签到中…" : "每日签到领积分"}
      </button>

      {onOpenInvite ? (
        <button
          type="button"
          onClick={onOpenInvite}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-purple-500/25 bg-purple-500/10 px-3 py-2.5 text-sm text-purple-200 transition hover:bg-purple-500/15"
        >
          <Gift className="size-4" />
          邀请有礼
        </button>
      ) : null}

      <button
        type="button"
        onClick={onLogout}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-400 transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300"
      >
        <LogOut className="size-4" />
        退出登录
      </button>
    </div>
  );
}
