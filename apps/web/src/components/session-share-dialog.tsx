"use client";

import { useEffect, useState } from "react";
import { Copy, Loader2, Share2, X } from "lucide-react";
import { GlassPanel } from "@aimarket/ui";
import {
  createSessionShare,
  fetchSessionShareStatus,
  revokeSessionShare,
} from "@/lib/api-client";
import { copyTextToClipboard } from "@/lib/clipboard";

interface SessionShareDialogProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  sessionTitle?: string;
}

export function SessionShareDialog({
  open,
  onClose,
  sessionId,
  sessionTitle,
}: SessionShareDialogProps) {
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [active, setActive] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setShareUrl(null);
    fetchSessionShareStatus(sessionId)
      .then((s) => {
        setActive(s.active);
        setExpiresAt(s.expiresAt);
      })
      .catch(() => {
        setActive(false);
        setExpiresAt(null);
      })
      .finally(() => setLoading(false));
  }, [open, sessionId]);

  if (!open) return null;

  async function handleCreate() {
    setPending(true);
    setError(null);
    try {
      const data = await createSessionShare(sessionId);
      setShareUrl(data.shareUrl);
      setActive(true);
      setExpiresAt(data.expiresAt);
      await copyTextToClipboard(data.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败");
    } finally {
      setPending(false);
    }
  }

  async function handleRevoke() {
    if (!confirm("撤销后原分享链接将失效，确定继续？")) return;
    setPending(true);
    setError(null);
    try {
      await revokeSessionShare(sessionId);
      setActive(false);
      setShareUrl(null);
      setExpiresAt(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "撤销失败");
    } finally {
      setPending(false);
    }
  }

  async function copyUrl() {
    if (!shareUrl) return;
    await copyTextToClipboard(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <GlassPanel className="relative w-full max-w-md p-6">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-zinc-500 hover:text-white"
          aria-label="关闭"
        >
          <X className="size-5" />
        </button>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Share2 className="size-5 text-orange-400" />
          分享作品
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          {sessionTitle ?
            `「${sessionTitle}」`
          : "生成只读链接，他人无需登录即可查看出图结果"}
        </p>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-6 animate-spin text-zinc-400" />
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {active && !shareUrl ? (
              <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200/90">
                分享已开启
                {expiresAt ?
                  `，将于 ${new Date(expiresAt).toLocaleDateString("zh-CN")} 过期`
                : ""}
                。重新生成链接将使旧链接失效。
              </p>
            ) : null}

            {shareUrl ? (
              <p className="break-all rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-zinc-300">
                {shareUrl}
              </p>
            ) : null}

            {error ? <p className="text-sm text-red-400">{error}</p> : null}

            <button
              type="button"
              disabled={pending}
              onClick={() => void handleCreate()}
              className="w-full rounded-full bg-gradient-to-r from-orange-500 to-purple-600 py-2.5 text-sm font-medium disabled:opacity-50"
            >
              {pending ?
                "处理中…"
              : shareUrl || active ?
                "重新生成并复制链接"
              : "生成分享链接"}
            </button>

            {shareUrl ? (
              <button
                type="button"
                onClick={() => void copyUrl()}
                className="flex w-full items-center justify-center gap-1 rounded-full border border-white/10 py-2 text-sm text-zinc-300 hover:bg-white/5"
              >
                <Copy className="size-4" />
                {copied ? "已复制" : "复制链接"}
              </button>
            ) : null}

            {active ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => void handleRevoke()}
                className="w-full rounded-full border border-red-500/30 py-2 text-sm text-red-300 hover:bg-red-500/10"
              >
                撤销分享
              </button>
            ) : null}
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
