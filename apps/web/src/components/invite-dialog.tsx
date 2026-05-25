"use client";

import { useEffect, useState } from "react";
import { Copy, Loader2, X } from "lucide-react";
import { GlassPanel } from "@aimarket/ui";
import { fetchInviteInfo } from "@/lib/api-client";
import type { InviteInfo } from "@/lib/types";

interface InviteDialogProps {
  open: boolean;
  onClose: () => void;
}

export function InviteDialog({ open, onClose }: InviteDialogProps) {
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchInviteInfo()
      .then(setInfo)
      .catch(() => setInfo(null))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  async function copyCode() {
    if (!info) return;
    await navigator.clipboard.writeText(info.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function copyLink() {
    if (!info) return;
    await navigator.clipboard.writeText(info.inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <GlassPanel className="relative w-full max-w-md p-6">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-zinc-500 hover:text-white"
        >
          <X className="size-5" />
        </button>
        <h2 className="text-xl font-semibold">邀请有礼</h2>
        <p className="mt-2 text-sm text-zinc-500">
          好友注册时填写你的邀请码，双方各得{" "}
          <span className="text-orange-400">
            {info?.rewardPerInvite ?? 100} 积分
          </span>
        </p>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : info ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-center">
              <p className="text-xs text-zinc-500">我的邀请码</p>
              <p className="mt-2 text-3xl font-bold tracking-widest text-orange-400">
                {info.code}
              </p>
              <button
                type="button"
                onClick={() => void copyCode()}
                className="mt-3 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white"
              >
                <Copy className="size-4" />
                {copied ? "已复制" : "复制邀请码"}
              </button>
            </div>
            <div className="flex justify-between text-sm text-zinc-500">
              <span>已成功邀请</span>
              <span className="text-white">{info.inviteCount} 人</span>
            </div>
            <div className="flex justify-between text-sm text-zinc-500">
              <span>累计获得</span>
              <span className="text-orange-400">{info.totalEarned} 积分</span>
            </div>
            <button
              type="button"
              onClick={() => void copyLink()}
              className="w-full rounded-full border border-white/10 py-2 text-sm hover:bg-white/5"
            >
              复制邀请链接
            </button>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-zinc-500">请先登录</p>
        )}
      </GlassPanel>
    </div>
  );
}
