"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { GlassPanel } from "@aimarket/ui";
import { assetUrl, fetchPublicShare } from "@/lib/api-client";
import { BrandLogo } from "@/components/brand-logo";
import type { PublicSharePayload } from "@/lib/types";

export default function PublicSharePage() {
  const params = useParams();
  const token = typeof params.token === "string" ? params.token : "";
  const [data, setData] = useState<PublicSharePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("分享链接无效");
      return;
    }
    let cancelled = false;
    fetchPublicShare(token)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "加载失败");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-100">
      <header className="border-b border-white/5 px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <BrandLogo variant="lockup" markSize="sm" />
          <Link
            href="/"
            className="text-sm text-orange-400 hover:text-orange-300"
          >
            我也要创作 →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {!data && !error ? (
          <div className="flex justify-center py-20 text-zinc-500">
            <Loader2 className="size-8 animate-spin" />
          </div>
        ) : null}

        {error ? (
          <GlassPanel className="p-8 text-center">
            <p className="text-red-400">{error}</p>
            <Link href="/" className="mt-4 inline-block text-sm text-zinc-500">
              返回首页
            </Link>
          </GlassPanel>
        ) : null}

        {data ? (
          <>
            <h1 className="text-2xl font-bold">{data.title}</h1>
            <p className="mt-1 text-sm text-zinc-500">
              只读分享 · 更新于{" "}
              {new Date(data.updatedAt).toLocaleString("zh-CN")}
            </p>

            <div className="mt-8 space-y-6">
              {data.messages
                .filter((m) => m.role === "assistant" && m.outputs.length > 0)
                .map((m) => (
                  <GlassPanel key={m.id} className="p-4">
                    {m.content ? (
                      <p className="mb-3 text-sm text-zinc-400">{m.content}</p>
                    ) : null}
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {m.outputs.map((o) => (
                        <a
                          key={o.id}
                          href={assetUrl(o.url)}
                          target="_blank"
                          rel="noreferrer"
                          className="overflow-hidden rounded-lg border border-white/10 bg-black/40"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={assetUrl(o.url)}
                            alt={o.label ?? "生成图"}
                            className="aspect-square w-full object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  </GlassPanel>
                ))}
            </div>

            {data.messages.every(
              (m) => m.role !== "assistant" || m.outputs.length === 0,
            ) ? (
              <p className="mt-8 text-center text-sm text-zinc-500">
                暂无可见出图内容
              </p>
            ) : null}
          </>
        ) : null}
      </main>
    </div>
  );
}
