"use client";

import { useState } from "react";
import { GlassPanel, Button } from "@aimarket/ui";
import { fetchAdminStats, fetchAdminUsers } from "@/lib/api-client";
import Link from "next/link";

const ADMIN_KEY = "aimarket_admin_secret";

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [authed, setAuthed] = useState(false);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const s = await fetchAdminStats(secret);
      const u = await fetchAdminUsers(secret);
      setStats(s.data);
      setUsers(u);
      sessionStorage.setItem(ADMIN_KEY, secret);
      setAuthed(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "验证失败";
      setError(
        msg === "Failed to fetch"
          ? "无法连接 API，请确认 http://localhost:4000 已启动并已重启服务"
          : msg,
      );
    }
  }

  function loadFromStorage() {
    const s = sessionStorage.getItem(ADMIN_KEY);
    if (s) {
      setSecret(s);
      void Promise.all([fetchAdminStats(s), fetchAdminUsers(s)]).then(
        ([statsRes, userList]) => {
          setStats(statsRes.data);
          setUsers(userList);
          setAuthed(true);
        },
      );
    }
  }

  return (
    <div className="min-h-dvh bg-black px-4 py-10 text-zinc-200">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-zinc-500 hover:text-white">
          ← 返回首页
        </Link>
        <h1 className="mt-4 text-2xl font-bold">管理后台</h1>
        <p className="mt-1 text-sm text-zinc-500">Phase 4 · 需 X-Admin-Secret</p>

        {!authed ? (
          <GlassPanel className="mt-6 p-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="管理密钥"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
              />
              {error ? <p className="text-sm text-red-400">{error}</p> : null}
              <Button type="submit" variant="primary" className="w-full">
                进入后台
              </Button>
            </form>
            <button
              type="button"
              onClick={loadFromStorage}
              className="mt-3 w-full text-xs text-zinc-500 hover:text-zinc-300"
            >
              使用已保存的密钥
            </button>
          </GlassPanel>
        ) : (
          <div className="mt-6 space-y-6">
            <GlassPanel className="grid grid-cols-2 gap-4 p-6 sm:grid-cols-4">
              <Stat label="用户" value={stats?.userCount as number} />
              <Stat label="任务" value={stats?.jobCount as number} />
              <Stat label="已付订单" value={stats?.orderCount as number} />
              <Stat
                label="待支付"
                value={stats?.pendingOrderCount as number}
              />
              <Stat
                label="收入"
                value={`¥${((stats?.revenueCents as number) ?? 0) / 100}`}
              />
            </GlassPanel>
            {stats?.provider ? (
              <GlassPanel className="p-4 text-sm text-zinc-400">
                Provider:{" "}
                {JSON.stringify(stats.provider as object)}
              </GlassPanel>
            ) : null}
            <GlassPanel className="p-6">
              <h2 className="font-medium">最近用户</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {users.map((u) => (
                  <li
                    key={u.id as string}
                    className="flex justify-between border-b border-white/5 py-2"
                  >
                    <span>{u.email as string}</span>
                    <span className="text-zinc-500">{u.credits as number} 积分</span>
                  </li>
                ))}
              </ul>
            </GlassPanel>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value ?? "—"}</p>
    </div>
  );
}
