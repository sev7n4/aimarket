"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, ChevronDown, ChevronUp, Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { LoginDialog } from "@/components/login-dialog";
import { fetchInspirationDetail, fetchInspirationPage, trackEvent } from "@/lib/api-client";
import {
  APPAREL_FAN_CATEGORIES,
  getApparelFanMeta,
  listApparelFanStaticFallback,
  type ApparelFanCategoryId,
  type ApparelFanItem,
} from "@/lib/inspiration-apparel-fan";
import { applyInspirationToStudio } from "@/lib/inspiration-studio";
import type { InspirationDetail } from "@/lib/types";

export interface ScenarioPickPreview {
  id: string;
  title: string;
  coverUrl: string;
}

interface FanDisplayItem {
  id: string;
  title: string;
  coverUrl: string;
  subtitle: string;
  tools: string[];
}

interface HomeScenarioFanProps {
  className?: string;
  expanded?: boolean;
  onExpandedChange?: (next: boolean) => void;
  onPicked?: (pick: ScenarioPickPreview) => void;
  lastPick?: ScenarioPickPreview | null;
}

const FAN_OFFSETS_DESKTOP = [-24, -16, -8, 0, 8, 16, 24];
const FAN_Y_OFFSETS_DESKTOP = [40, 22, 8, 0, 8, 22, 40];

const useApiSource =
  typeof process.env.NEXT_PUBLIC_INSPIRATION_SOURCE === "undefined" ||
  process.env.NEXT_PUBLIC_INSPIRATION_SOURCE === "api";

function staticDetailFromFan(item: ApparelFanItem): InspirationDetail {
  return {
    id: item.id,
    title: item.title,
    category: item.category,
    prompt: item.prompt,
    modelId: item.modelId,
    aspectRatio: item.aspectRatio,
    resolution: item.resolution,
    coverUrl: item.coverUrl,
    referenceAssets: [{ url: item.coverUrl }],
  };
}

function toDisplayItem(
  id: string,
  title: string,
  coverUrl: string,
): FanDisplayItem {
  const meta = getApparelFanMeta(id);
  const fallback = listApparelFanStaticFallback().find((i) => i.id === id);
  return {
    id,
    title,
    coverUrl,
    subtitle: meta?.subtitle ?? fallback?.subtitle ?? "",
    tools: meta?.tools ?? fallback?.tools ?? [],
  };
}

export function HomeScenarioFan({
  className = "",
  expanded: controlledExpanded,
  onExpandedChange,
  onPicked,
  lastPick,
}: HomeScenarioFanProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const [internalExpanded, setInternalExpanded] = useState(true);
  const [loading, setLoading] = useState(useApiSource);
  const [pickingId, setPickingId] = useState<string | null>(null);
  const [apiItems, setApiItems] = useState<FanDisplayItem[] | null>(null);

  const expanded = controlledExpanded ?? internalExpanded;
  const setExpanded = (next: boolean) => {
    setInternalExpanded(next);
    onExpandedChange?.(next);
  };

  const [activeCategory, setActiveCategory] =
    useState<ApparelFanCategoryId>("apparel");
  const [activeIndex, setActiveIndex] = useState<number>(3);

  const loadFan = useCallback(async () => {
    if (!useApiSource || activeCategory !== "apparel") {
      setApiItems(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchInspirationPage({
        fanSet: "apparel",
        pageSize: 7,
      });
      setApiItems(
        data.rows.map((row) => toDisplayItem(row.id, row.title, row.coverUrl)),
      );
    } catch {
      setApiItems(null);
    } finally {
      setLoading(false);
    }
  }, [activeCategory]);

  useEffect(() => {
    void loadFan();
  }, [loadFan]);

  const templates: FanDisplayItem[] = useMemo(() => {
    if (activeCategory !== "apparel") return [];
    if (apiItems && apiItems.length > 0) return apiItems.slice(0, 7);
    return listApparelFanStaticFallback().map((item) =>
      toDisplayItem(item.id, item.title, item.coverUrl),
    );
  }, [activeCategory, apiItems]);

  useEffect(() => {
    setActiveIndex(Math.min(3, Math.max(0, templates.length - 1)));
  }, [activeCategory, templates.length]);

  async function handlePick(item: FanDisplayItem) {
    if (!user) {
      setLoginOpen(true);
      return;
    }
    setPickingId(item.id);
    try {
      let detail: InspirationDetail;
      if (useApiSource && apiItems) {
        detail = await fetchInspirationDetail(item.id);
      } else {
        const staticItem = listApparelFanStaticFallback().find(
          (i) => i.id === item.id,
        );
        if (!staticItem) return;
        detail = staticDetailFromFan(staticItem);
      }

      void trackEvent("scenario_pick", {
        scenarioId: detail.id,
        category: detail.category,
      });
      onPicked?.({
        id: detail.id,
        title: detail.title,
        coverUrl: detail.coverUrl,
      });
      applyInspirationToStudio(detail, router);
    } catch (err) {
      console.error(err);
    } finally {
      setPickingId(null);
    }
  }

  return (
    <section
      className={`mx-auto w-full max-w-5xl px-3 pt-4 sm:px-4 lg:pt-6 ${className}`}
      aria-label="灵感套图扇形入口"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="group flex items-center gap-2 text-left"
          aria-expanded={expanded}
        >
          <p className="flex items-center gap-1 text-sm font-medium text-zinc-100">
            灵感套图 · 一键做同款
            {expanded ? (
              <ChevronUp className="size-4 text-zinc-500 transition group-hover:text-zinc-300" />
            ) : (
              <ChevronDown className="size-4 text-zinc-500 transition group-hover:text-zinc-300" />
            )}
          </p>
          <span className="text-[11px] text-zinc-500">
            {lastPick
              ? `上次：${lastPick.title}`
              : "服装类 7 个高频场景"}
          </span>
        </button>
        {expanded ? (
          <div className="flex flex-wrap gap-1.5">
            {APPAREL_FAN_CATEGORIES.map((category) => {
              const isActive = activeCategory === category.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  disabled={!category.available}
                  onClick={() => setActiveCategory(category.id)}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    isActive
                      ? "border-orange-400/60 bg-orange-500/15 text-orange-200"
                      : category.available
                        ? "border-white/15 text-zinc-300 hover:border-orange-400/40"
                        : "border-white/5 text-zinc-600"
                  }`}
                  title={category.description}
                >
                  {category.label}
                  {!category.available ? (
                    <span className="ml-1 text-[10px] text-zinc-500">
                      即将上线
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {expanded ? (
        <div className="mt-3">
          {loading && templates.length === 0 ? (
            <p className="py-16 text-center text-sm text-zinc-500">
              加载灵感套图中…
            </p>
          ) : null}

          {activeCategory !== "apparel" ? (
            <p className="py-16 text-center text-sm text-zinc-500">
              该品类即将上线，敬请期待
            </p>
          ) : (
            <>
              <div className="relative hidden h-[360px] items-end justify-center lg:flex">
                {templates.map((template, index) => {
                  const rotate = FAN_OFFSETS_DESKTOP[index] ?? 0;
                  const translateY = FAN_Y_OFFSETS_DESKTOP[index] ?? 0;
                  const isActive = activeIndex === index;
                  const zIndex = isActive ? 35 : 30 - Math.abs(index - 3);
                  const isPicking = pickingId === template.id;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      disabled={isPicking}
                      onMouseEnter={() => setActiveIndex(index)}
                      onFocus={() => setActiveIndex(index)}
                      onClick={() => void handlePick(template)}
                      style={{
                        transform: `translate(${(index - 3) * 96}px, ${translateY}px) rotate(${rotate}deg) scale(${isActive ? 1.08 : 0.94})`,
                        zIndex,
                      }}
                      className="group absolute bottom-0 h-[300px] w-[200px] origin-bottom overflow-hidden rounded-2xl border border-white/10 bg-[#111] shadow-[0_12px_32px_rgba(0,0,0,0.45)] transition duration-300 hover:border-orange-400/50 disabled:opacity-60"
                      aria-label={`选择场景：${template.title}`}
                    >
                      <Image
                        src={template.coverUrl}
                        alt={template.title}
                        fill
                        sizes="200px"
                        className="object-cover transition duration-500 group-hover:scale-[1.04]"
                        unoptimized
                      />
                      {isPicking ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <Loader2 className="size-6 animate-spin text-orange-300" />
                        </div>
                      ) : null}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-orange-300/90">
                          服装
                        </p>
                        <p className="mt-0.5 text-sm font-medium text-white">
                          {template.title}
                        </p>
                        <p className="mt-1 line-clamp-2 text-[10px] text-zinc-300/90">
                          {template.subtitle}
                        </p>
                        <div
                          className={`mt-2 flex flex-wrap gap-1 text-[9px] text-zinc-200/80 ${
                            isActive ? "opacity-100" : "opacity-0"
                          } transition`}
                        >
                          {template.tools.map((tool) => (
                            <span
                              key={tool}
                              className="rounded-full border border-white/15 bg-black/40 px-1.5 py-0.5"
                            >
                              {tool}
                            </span>
                          ))}
                        </div>
                        <div
                          className={`mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-orange-300 ${
                            isActive ? "opacity-100" : "opacity-0"
                          } transition`}
                        >
                          做同款 <ArrowRight className="size-3" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="-mx-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden">
                <div className="flex snap-x snap-mandatory gap-3 px-3">
                  {templates.map((template) => {
                    const isPicking = pickingId === template.id;
                    return (
                      <button
                        key={template.id}
                        type="button"
                        disabled={isPicking}
                        onClick={() => void handlePick(template)}
                        className="group relative w-[44vw] max-w-[200px] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/10 bg-[#111] shadow-[0_8px_24px_rgba(0,0,0,0.45)] disabled:opacity-60"
                        aria-label={`选择场景：${template.title}`}
                      >
                        <div className="relative aspect-[3/4] w-full">
                          <Image
                            src={template.coverUrl}
                            alt={template.title}
                            fill
                            sizes="44vw"
                            className="object-cover"
                            unoptimized
                          />
                          {isPicking ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                              <Loader2 className="size-5 animate-spin text-orange-300" />
                            </div>
                          ) : null}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                          <div className="absolute inset-x-0 bottom-0 p-2.5">
                            <p className="text-[9px] uppercase tracking-wider text-orange-300/90">
                              服装
                            </p>
                            <p className="mt-0.5 text-xs font-medium text-white">
                              {template.title}
                            </p>
                            <p className="mt-0.5 line-clamp-2 text-[9px] text-zinc-300/90">
                              {template.subtitle}
                            </p>
                            <div className="mt-1.5 inline-flex items-center gap-1 text-[9px] font-medium text-orange-300">
                              <Sparkles className="size-2.5" /> 做同款
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1 px-3 text-[10px] text-zinc-500">
                  左右滑动查看 7 个高频场景
                </p>
              </div>
            </>
          )}
        </div>
      ) : null}

      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
    </section>
  );
}
