"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  inspirationCategories,
  inspirationItems,
  type InspirationCategory,
} from "@/lib/inspiration";
import {
  fetchInspirationDetail,
  fetchInspirationPage,
  trackEvent,
} from "@/lib/api-client";
import type { InspirationDetail, InspirationListItem } from "@/lib/types";
import { InspirationSlotSheet } from "@/components/inspiration-slot-sheet";
import { LoginDialog } from "@/components/login-dialog";

const PAGE_SIZE = 12;

const useApiSource =
  typeof process.env.NEXT_PUBLIC_INSPIRATION_SOURCE === "undefined" ||
  process.env.NEXT_PUBLIC_INSPIRATION_SOURCE === "api";

type GalleryItem = {
  id: string;
  title: string;
  category: string;
  coverUrl: string;
};

function staticToGallery(): GalleryItem[] {
  return inspirationItems.map((i) => ({
    id: i.id,
    title: i.title,
    category: i.category,
    coverUrl: i.coverUrl,
  }));
}

export function InspirationGallery() {
  const [category, setCategory] = useState<InspirationCategory>("全部");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [apiItems, setApiItems] = useState<InspirationListItem[] | null>(null);
  const [loading, setLoading] = useState(useApiSource);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [slotDetail, setSlotDetail] = useState<InspirationDetail | null>(null);
  const [slotOpen, setSlotOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const loadPage = useCallback(async () => {
    if (!useApiSource) return;
    setLoading(true);
    try {
      const data = await fetchInspirationPage({
        pageNum: 1,
        pageSize: 50,
        category: category === "全部" ? undefined : category,
      });
      setApiItems(data.rows);
    } catch {
      setApiItems(null);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const allItems: GalleryItem[] = useMemo(() => {
    if (apiItems && apiItems.length > 0) {
      return apiItems.map((r) => ({
        id: r.id,
        title: r.title,
        category: r.category,
        coverUrl: r.coverUrl,
      }));
    }
    const staticList = staticToGallery();
    if (category === "全部") return staticList;
    return staticList.filter((i) => i.category === category);
  }, [apiItems, category]);

  const shown = allItems.slice(0, visible);
  const hasMore = visible < allItems.length;

  async function handleClick(item: GalleryItem) {
    setLoadingId(item.id);
    try {
      if (useApiSource && apiItems) {
        const detail = await fetchInspirationDetail(item.id);
        setSlotDetail(detail);
        setSlotOpen(true);
        void trackEvent("inspiration_click", {
          inspirationId: detail.id,
          category: detail.category,
        });
      } else {
        const staticItem = inspirationItems.find((i) => i.id === item.id);
        setSlotDetail({
          id: item.id,
          title: item.title,
          category: item.category,
          prompt: staticItem?.prompt ?? item.title,
          modelId: "latest-v2-pro",
          aspectRatio: "1:1",
          resolution: "2k",
          coverUrl: item.coverUrl,
          referenceAssets: [{ url: item.coverUrl }],
        });
        setSlotOpen(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pb-20 pt-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">
            灵感发现 <span aria-hidden>🔥</span>
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {inspirationCategories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setCategory(c);
                  setVisible(PAGE_SIZE);
                }}
                className={`rounded-full px-3 py-1 text-xs transition ${
                  category === c ?
                    "bg-white text-black"
                  : "border border-white/10 text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {loading && !shown.length ?
          <p className="py-12 text-center text-sm text-zinc-500">加载灵感中…</p>
        : null}

        <div className="columns-2 gap-3 sm:columns-3 lg:columns-4">
          {shown.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={loadingId === item.id}
              onClick={() => void handleClick(item)}
              className="group relative mb-3 block w-full break-inside-avoid overflow-hidden rounded-2xl border border-white/10 text-left transition hover:border-orange-500/40 disabled:opacity-60"
            >
              <div className="relative aspect-[4/5] w-full bg-zinc-900">
                <Image
                  src={item.coverUrl}
                  alt={item.title}
                  fill
                  sizes="(max-width: 640px) 50vw, 25vw"
                  className="object-cover transition duration-300 group-hover:scale-[1.03]"
                  unoptimized
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <span className="text-[10px] uppercase tracking-wider text-orange-300/90">
                    {item.category}
                  </span>
                  <span className="mt-0.5 block text-sm font-medium text-white">
                    {item.title}
                  </span>
                  <span className="mt-1 block text-[10px] text-zinc-400 opacity-0 transition group-hover:opacity-100">
                    做同款 →
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>

        {hasMore ?
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
              className="rounded-full border border-white/10 px-6 py-2 text-sm text-zinc-400 hover:border-white/20 hover:text-white"
            >
              加载更多（{allItems.length - visible} 条）
            </button>
          </div>
        : null}
      </section>

      <InspirationSlotSheet
        detail={slotDetail}
        open={slotOpen}
        onClose={() => setSlotOpen(false)}
        onAuthRequired={() => setLoginOpen(true)}
      />
      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}
