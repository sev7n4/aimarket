"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { Button, GlassPanel } from "@aimarket/ui";
import { sendSmsCode } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { BRAND_NAME } from "@/lib/brand";

const INVITE_KEY = "aimarket_invite_code";

type AuthTab = "phone" | "email" | "wechat";

interface LoginDialogProps {
  open: boolean;
  onClose: () => void;
}

export function LoginDialog({ open, onClose }: LoginDialogProps) {
  const { login, loginPhone, loginWechat, register } = useAuth();
  const [tab, setTab] = useState<AuthTab>("phone");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [devSmsHint, setDevSmsHint] = useState<string | null>(null);
  const [smsCooldown, setSmsCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    if (!open) return;
    const stored =
      typeof window !== "undefined"
        ? sessionStorage.getItem(INVITE_KEY)
        : null;
    if (stored) setInviteCode(stored);
  }, [open]);

  useEffect(() => {
    if (smsCooldown <= 0) return;
    const t = setTimeout(() => setSmsCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [smsCooldown]);

  if (!open) return null;

  async function handleSendSms() {
    const normalized = phone.replace(/\D/g, "");
    if (!/^1\d{10}$/.test(normalized)) {
      setError("请输入 11 位手机号");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const res = await sendSmsCode(normalized);
      setSmsCooldown(60);
      setDevSmsHint(
        res.devCode
          ? `开发环境验证码：${res.devCode}`
          : res.message,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败");
    } finally {
      setPending(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (tab === "email" && mode === "register" && !agreed) {
      setError("请先阅读并同意服务条款与隐私政策");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const invite = inviteCode.trim() || undefined;
      if (tab === "phone") {
        await loginPhone(phone.replace(/\D/g, ""), smsCode, invite);
      } else if (tab === "wechat") {
        await loginWechat("mock", invite);
      } else if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password, invite);
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
          {mode === "login" ? `登录${BRAND_NAME}` : `注册${BRAND_NAME}`}
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          新用户注册即赠 100 积分
          {inviteCode ? "，填写邀请码双方再得奖励" : ""}
        </p>

        <div className="mt-4 flex gap-1 rounded-xl border border-white/10 bg-black/30 p-1">
          {(
            [
              { id: "phone" as const, label: "手机号" },
              { id: "wechat" as const, label: "微信" },
              { id: "email" as const, label: "邮箱" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                setError(null);
              }}
              className={`flex-1 rounded-lg py-2 text-xs transition ${
                tab === t.id
                  ? "bg-white/10 text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {tab === "phone" ? (
            <>
              <div className="flex gap-2">
                <input
                  type="tel"
                  inputMode="numeric"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="手机号"
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-orange-500/50"
                />
                <button
                  type="button"
                  disabled={pending || smsCooldown > 0}
                  onClick={() => void handleSendSms()}
                  className="shrink-0 rounded-xl border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5 disabled:opacity-40"
                >
                  {smsCooldown > 0 ? `${smsCooldown}s` : "获取验证码"}
                </button>
              </div>
              <input
                type="text"
                inputMode="numeric"
                required
                value={smsCode}
                onChange={(e) => setSmsCode(e.target.value)}
                placeholder="短信验证码"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-orange-500/50"
              />
              {devSmsHint ? (
                <p className="text-xs text-amber-400/90">{devSmsHint}</p>
              ) : null}
            </>
          ) : null}

          {tab === "email" ? (
            <>
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
                  onChange={(e) =>
                    setInviteCode(e.target.value.toUpperCase())
                  }
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
                    <Link
                      href="/terms"
                      className="text-orange-400 hover:underline"
                    >
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
            </>
          ) : null}

          {tab === "wechat" ? (
            <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-6 text-center">
              <MessageCircle className="mx-auto size-10 text-emerald-400" />
              <p className="mt-3 text-sm text-zinc-300">
                微信一键登录（开发环境使用模拟授权）
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                生产环境需配置微信开放平台 AppID 与回调
              </p>
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={
              pending ||
              (tab === "email" && mode === "register" && !agreed)
            }
          >
            {pending ? (
              <Loader2 className="mx-auto size-5 animate-spin" />
            ) : tab === "wechat" ? (
              "微信登录"
            ) : tab === "phone" ? (
              "手机号登录 / 注册"
            ) : mode === "login" ? (
              "登录"
            ) : (
              "注册"
            )}
          </Button>
        </form>

        {tab === "email" ? (
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
        ) : null}

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
