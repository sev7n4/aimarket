"use client";

import { useRouter } from "next/navigation";
import { inspirationItems } from "@/lib/inspiration";

const aspectClass = {
  portrait: "row-span-2 min-h-[220px]",
  landscape: "col-span-1 min-h-[140px]",
  square: "min-h-[180px]",
} as const;

export function InspirationGallery() {
  const router = useRouter();

  return (
    <section className="mx-auto max-w-6xl px-4 pb-20 pt-10">
      <h2 className="mb-6 text-xl font-semibold">
        灵感发现 <span aria-hidden>🔥</span>
      </h2>
      <div className="columns-2 gap-3 sm:columns-3 lg:columns-4">
        {inspirationItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              const sessionId = crypto.randomUUID();
              router.push(
                `/studio?sessionId=${sessionId}&mode=chat&q=${encodeURIComponent(item.prompt)}`,
              );
            }}
            className={`mb-3 block w-full break-inside-avoid overflow-hidden rounded-2xl border border-white/10 text-left transition hover:scale-[1.02] hover:border-orange-500/30 ${aspectClass[item.aspect]}`}
          >
            <div
              className={`flex h-full min-h-[inherit] flex-col justify-end bg-gradient-to-br p-4 ${item.gradient}`}
            >
              <span className="text-[10px] uppercase tracking-wider text-white/60">
                {item.category}
              </span>
              <span className="mt-1 text-sm font-medium text-white">
                {item.title}
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
