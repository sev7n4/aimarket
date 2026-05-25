"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, GlassPanel } from "@aimarket/ui";
import { useAuth } from "@/lib/auth-context";

const INVITE_KEY = "aimarket_invite_code";

interface LoginDialogProps {
  open: boolean;
  onClose: () => void;
}

export function LoginDialog({ open, onClose }: LoginDialogProps) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    if (open && mode === "register") {
      const stored =
        typeof window !== "undefined"
          ? sessionStorage.getItem(INVITE_KEY)
          : null;
      if (stored) setInviteCode(stored);
    }
  }, [open, mode]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "register" && !agreed) {
      setError("请先阅读并同意服务条款与隐私政策");
      return;
    }
    setError(null);
    setPending(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(
          email,
          password,
          inviteCode.trim() || undefined,
        );
        sessionStorage.removeItem(INVITE_KEY);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <GlassPanel className="w-full max-w-md p-6">
        <h2 className="text-xl font-semibold">
          {mode === "login" ? "登录 AIMarket" : "注册 AIMarket"}
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          新用户注册即赠 100 积分
          {inviteCode ? "，填写邀请码双方再得奖励" : ""}
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="邮箱"
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-orange-500/50"
          />
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="密码（至少 8 位）"
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-orange-500/50"
          />
          {mode === "register" ? (
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="邀请码（可选）"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm uppercase outline-none focus:border-purple-500/50"
            />
          ) : null}
          {mode === "register" ? (
            <label className="flex items-start gap-2 text-xs text-zinc-500">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                我已阅读并同意
                <Link href="/terms" className="text-orange-400 hover:underline">
                  服务条款
                </Link>
                与
                <Link
                  href="/privacy"
                  className="text-orange-400 hover:underline"
                >
                  隐私政策
                </Link>
              </span>
            </label>
          ) : null}
          {error ? (
            <p className="text-sm text-red-400">{error}</p>
          ) : null}
          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={pending || (mode === "register" && !agreed)}
          >
            {pending ? "处理中…" : mode === "login" ? "登录" : "注册"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-zinc-500">
          {mode === "login" ? "还没有账号？" : "已有账号？"}
          <button
            type="button"
            className="ml-1 text-orange-400 hover:underline"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login" ? "立即注册" : "去登录"}
          </button>
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full text-sm text-zinc-500 hover:text-zinc-300"
        >
          关闭
        </button>
      </GlassPanel>
    </div>
  );
}

export { INVITE_KEY };
