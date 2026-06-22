"use client";

import Link from "next/link";
import { Clapperboard, ImageIcon, ShoppingBag } from "lucide-react";
import {
  buildProductionStudioUrl,
  buildStudioUrl,
} from "@/lib/studio-navigation";
import { trackEvent } from "@/lib/api-client";

type EntrySource = "home_hero" | "home_hero_ecommerce" | "home_hero_canvas";

function trackEntry(source: EntrySource) {
  if (source === "home_hero") {
    void trackEvent("production_entry_click", { source }, { auth: false });
  }
}

/** 首页 Hero 制片 / 电商 / 画布三入口（PROD-A01） */
export function HomeProductionEntry() {
  const productionHref = buildProductionStudioUrl();
  const ecommerceHref = buildStudioUrl("canvas", {
    mode: "ecommerce",
    title: "电商套图",
  });
  const canvasHref = buildStudioUrl("canvas", { mode: "image" });

  const btnBase =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-400/60";

  return (
    <div
      className="flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center"
      data-testid="home-production-entry"
    >
      <Link
        href={productionHref}
        data-testid="home-entry-production"
        onClick={() => trackEntry("home_hero")}
        className={`${btnBase} bg-gradient-to-r from-purple-600 to-violet-500 text-white shadow-lg shadow-purple-900/30 hover:from-purple-500 hover:to-violet-400`}
      >
        <Clapperboard className="size-4 shrink-0" aria-hidden />
        开始制片
      </Link>
      <Link
        href={ecommerceHref}
        data-testid="home-entry-ecommerce"
        onClick={() => trackEntry("home_hero_ecommerce")}
        className={`${btnBase} border border-white/15 bg-white/[0.06] text-zinc-100 hover:border-orange-500/35 hover:bg-orange-500/10`}
      >
        <ShoppingBag className="size-4 shrink-0 text-orange-400" aria-hidden />
        电商套图
      </Link>
      <Link
        href={canvasHref}
        data-testid="home-entry-canvas"
        onClick={() => trackEntry("home_hero_canvas")}
        className={`${btnBase} border border-white/15 bg-white/[0.06] text-zinc-100 hover:border-white/25 hover:bg-white/10`}
      >
        <ImageIcon className="size-4 shrink-0 text-zinc-400" aria-hidden />
        自由画布
      </Link>
    </div>
  );
}
