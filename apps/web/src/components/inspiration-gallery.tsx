"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  inspirationCategories,
  inspirationItems,
  type InspirationCategory,
} from "@/lib/inspiration";

const PAGE_SIZE = 12;

export function InspirationGallery() {
  const router = useRouter();
  const [category, setCategory] = useState<InspirationCategory>("全部");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    if (category === "全部") return inspirationItems;
    return inspirationItems.filter((i) => i.category === category);
  }, [category]);

  const shown = filtered.slice(0, visible);
  const hasMore = visible < filtered.length;

  return (
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
                category === c
                  ? "bg-white text-black"
                  : "border border-white/10 text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="columns-2 gap-3 sm:columns-3 lg:columns-4">
        {shown.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              const sessionId = crypto.randomUUID();
              router.push(
                `/studio?sessionId=${sessionId}&mode=chat&q=${encodeURIComponent(item.prompt)}`,
              );
            }}
            className="group relative mb-3 block w-full break-inside-avoid overflow-hidden rounded-2xl border border-white/10 text-left transition hover:border-orange-500/40"
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
              </div>
            </div>
          </button>
        ))}
      </div>

      {hasMore ? (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="rounded-full border border-white/10 px-6 py-2 text-sm text-zinc-400 hover:border-white/20 hover:text-white"
          >
            加载更多（{filtered.length - visible} 条）
          </button>
        </div>
      ) : null}
    </section>
  );
}
