"use client";

import { useState } from "react";
import { GlassPanel, Button } from "@aimarket/ui";
import {
  fetchAdminStats,
  fetchAdminUsers,
  fetchAdminReports,
  fetchAdminAnalytics,
  updateAdminReport,
} from "@/lib/api-client";
import Link from "next/link";

const ADMIN_KEY = "aimarket_admin_secret";

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [authed, setAuthed] = useState(false);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [reports, setReports] = useState<Record<string, unknown>[]>([]);
  const [reportStatus, setReportStatus] = useState<"pending" | "reviewed" | "dismissed">("pending");
  const [analytics, setAnalytics] = useState<{
    days: number;
    total: number;
    byName: { name: string; count: number }[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const s = await fetchAdminStats(secret);
      const u = await fetchAdminUsers(secret);
      const r = await fetchAdminReports(secret, "pending");
      const a = await fetchAdminAnalytics(secret, 7);
      setStats(s.data);
      setUsers(u);
      setReports(r);
      setAnalytics(a.data);
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
      void Promise.all([
        fetchAdminStats(s),
        fetchAdminUsers(s),
        fetchAdminReports(s, "pending"),
        fetchAdminAnalytics(s, 7),
      ]).then(([statsRes, userList, reportList, analyticsRes]) => {
        setStats(statsRes.data);
        setUsers(userList);
        setReports(reportList);
        setAnalytics(analyticsRes.data);
        setAuthed(true);
      });
    }
  }

  return (
    <div className="min-h-dvh bg-black px-4 py-10 text-zinc-200">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-zinc-500 hover:text-white">
          ← 返回首页
        </Link>
        <h1 className="mt-4 text-2xl font-bold">管理后台</h1>
        <p className="mt-1 text-sm text-zinc-500">Phase 4–8 · 需 X-Admin-Secret</p>

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
                <p>图像引擎：{JSON.stringify(stats.provider as object)}</p>
                {stats.moderation ? (
                  <p className="mt-2">
                    内容审核：{JSON.stringify(stats.moderation as object)}
                  </p>
                ) : null}
                {stats.rateLimit ? (
                  <p className="mt-2">
                    限流存储：{JSON.stringify(stats.rateLimit as object)}
                  </p>
                ) : null}
              </GlassPanel>
            ) : null}
            {analytics ? (
              <GlassPanel className="p-6">
                <h2 className="font-medium">
                  埋点统计（近 {analytics.days} 天）
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  共 {analytics.total} 条事件
                </p>
                <ul className="mt-3 space-y-2 text-sm">
                  {analytics.byName.map((row) => (
                    <li
                      key={row.name}
                      className="flex justify-between border-b border-white/5 py-2"
                    >
                      <span className="font-mono text-zinc-300">{row.name}</span>
                      <span className="text-zinc-500">{row.count}</span>
                    </li>
                  ))}
                </ul>
              </GlassPanel>
            ) : null}
            <GlassPanel className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-medium">内容举报</h2>
                <select
                  value={reportStatus}
                  onChange={(e) => {
                    const next = e.target.value as typeof reportStatus;
                    setReportStatus(next);
                    const s = sessionStorage.getItem(ADMIN_KEY);
                    if (s) {
                      void fetchAdminReports(s, next).then(setReports);
                    }
                  }}
                  className="rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-xs"
                >
                  <option value="pending">待处理</option>
                  <option value="reviewed">已处理</option>
                  <option value="dismissed">已驳回</option>
                </select>
              </div>
              {reports.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-500">暂无举报</p>
              ) : (
                <ul className="mt-3 space-y-3 text-sm">
                  {reports.map((r) => (
                    <li
                      key={r.id as string}
                      className="rounded-xl border border-white/5 p-3"
                    >
                      <p className="text-zinc-300">{r.reason as string}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {r.reporter_email as string} ·{" "}
                        {r.created_at as string}
                      </p>
                      {r.content_url ? (
                        <a
                          href={r.content_url as string}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 block truncate text-xs text-blue-400 hover:underline"
                        >
                          {r.content_url as string}
                        </a>
                      ) : null}
                      {r.status === "pending" ? (
                        <div className="mt-2 flex gap-2">
                          <Button
                            type="button"
                            variant="primary"
                            className="text-xs"
                            onClick={() => {
                              const s = sessionStorage.getItem(ADMIN_KEY);
                              if (!s) return;
                              void updateAdminReport(s, r.id as string, {
                                status: "reviewed",
                              }).then(() =>
                                fetchAdminReports(s, reportStatus).then(
                                  setReports,
                                ),
                              );
                            }}
                          >
                            标记已处理
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            className="text-xs"
                            onClick={() => {
                              const s = sessionStorage.getItem(ADMIN_KEY);
                              if (!s) return;
                              void updateAdminReport(s, r.id as string, {
                                status: "dismissed",
                              }).then(() =>
                                fetchAdminReports(s, reportStatus).then(
                                  setReports,
                                ),
                              );
                            }}
                          >
                            驳回
                          </Button>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-zinc-500">
                          状态：{r.status as string}
                          {r.admin_note
                            ? ` · ${r.admin_note as string}`
                            : ""}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </GlassPanel>
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
