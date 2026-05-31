"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
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

/** 扇形几何配置（桌面 / 移动分离：移动更紧凑，避免溢出） */
type FanGeometry = {
  spread: number;
  offsets: number[];
  yOffsets: number[];
  bleed: number;
  maxY: number;
};

const FAN_CENTER_INDEX = 3;
const FAN_CARD_W = 200;
const FAN_CARD_H = 300;

function fanStageWidth(geom: FanGeometry) {
  return (7 - 1) * geom.spread + FAN_CARD_W + geom.bleed * 2;
}

const DESKTOP_FAN: FanGeometry = {
  spread: 112,
  offsets: [-32, -21, -10, 0, 10, 21, 32],
  yOffsets: [56, 33, 12, 0, 12, 33, 56],
  bleed: 52,
  maxY: 56,
};

/** 移动端 / PAD：7 张重叠扇形（几何同 PC，响应式缩放） */
const MOBILE_FAN = {
  minCardW: 104,
  maxCardW: 176,
  cardWRatio: 0.36,
  edgePad: 10,
  /** spread / cardW，与 PC(112/200≈0.56) 同量级，保证重叠感 */
  spreadMinRatio: 0.44,
  spreadMaxRatio: 0.58,
};

const MOBILE_SWIPE_THRESHOLD_PX = 36;
const MOBILE_FIT_SAFETY_PX = 8;
const MOBILE_MIN_LAYOUT_SCALE = 0.72;

type MobileLayout = {
  spread: number;
  scale: number;
  cardW: number;
  cardH: number;
  stageW: number;
  stageH: number;
  bleed: number;
  maxYOffset: number;
  offsets: number[];
  yOffsets: number[];
};

function fanMobileStageWidth(spread: number, cardW: number, bleed: number) {
  return (7 - 1) * spread + cardW + bleed * 2;
}

function outerCardHalf(cardW: number, cardH: number, deg: number, cardScale = 0.94) {
  const rad = (deg * Math.PI) / 180;
  return cardScale * ((cardW / 2) * Math.cos(rad) + cardH * Math.sin(rad));
}

/** 7 张固定扇形：先算 stage 再 scale 纳入视口 */
function fitMobileLayout(viewportW: number): MobileLayout {
  const { edgePad, minCardW, maxCardW, cardWRatio, spreadMinRatio, spreadMaxRatio } =
    MOBILE_FAN;
  const usable = viewportW - edgePad * 2;
  const safety = MOBILE_FIT_SAFETY_PX;
  const maxRel = FAN_CENTER_INDEX;
  const maxAngle = Math.max(...DESKTOP_FAN.offsets.map((d) => Math.abs(d)));

  for (
    let cardW = Math.round(Math.min(maxCardW, Math.max(minCardW, viewportW * cardWRatio)));
    cardW >= minCardW;
    cardW -= 2
  ) {
    const cardH = Math.round(cardW * 1.5);
    const ratio = cardW / FAN_CARD_W;
    const bleed = Math.round(DESKTOP_FAN.bleed * ratio);
    const yOffsets = DESKTOP_FAN.yOffsets.map((y) => Math.round(y * ratio));
    const maxYOffset = Math.max(...yOffsets);
    const outerHalf = outerCardHalf(cardW, cardH, maxAngle);
    const maxSpread = (usable / 2 - outerHalf - safety) / maxRel;
    const spread = Math.max(
      Math.floor(cardW * spreadMinRatio),
      Math.min(Math.floor(maxSpread), Math.floor(cardW * spreadMaxRatio)),
    );
    const stageW = fanMobileStageWidth(spread, cardW, bleed);
    const stageH = cardH + maxYOffset;
    const rotatedSpan = 2 * maxRel * spread + 2 * outerHalf;
    const layoutW = Math.max(stageW, rotatedSpan);
    const scale = Math.min(1, usable / layoutW);
    if (scale >= MOBILE_MIN_LAYOUT_SCALE || cardW <= minCardW + 2) {
      return {
        spread,
        scale,
        cardW,
        cardH,
        stageW,
        stageH,
        bleed,
        maxYOffset,
        offsets: DESKTOP_FAN.offsets,
        yOffsets,
      };
    }
  }

  const cardW = minCardW;
  const cardH = Math.round(cardW * 1.5);
  const ratio = cardW / FAN_CARD_W;
  const bleed = Math.round(DESKTOP_FAN.bleed * ratio);
  const yOffsets = DESKTOP_FAN.yOffsets.map((y) => Math.round(y * ratio));
  const maxYOffset = Math.max(...yOffsets);
  const outerHalf = outerCardHalf(cardW, cardH, maxAngle);
  const maxSpread = (usable / 2 - outerHalf - safety) / maxRel;
  const spread = Math.max(
    Math.floor(cardW * spreadMinRatio),
    Math.min(Math.floor(maxSpread), Math.floor(cardW * spreadMaxRatio)),
  );
  const stageW = fanMobileStageWidth(spread, cardW, bleed);
  const stageH = cardH + maxYOffset;
  const rotatedSpan = 2 * maxRel * spread + 2 * outerHalf;
  const layoutW = Math.max(stageW, rotatedSpan);
  return {
    spread,
    scale: Math.min(1, usable / layoutW),
    cardW,
    cardH,
    stageW,
    stageH,
    bleed,
    maxYOffset,
    offsets: DESKTOP_FAN.offsets,
    yOffsets,
  };
}

const FAN_STAGE_W = fanStageWidth(DESKTOP_FAN);

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
  const [mobileLayout, setMobileLayout] = useState<MobileLayout>({
    spread: 68,
    scale: 1,
    cardW: 128,
    cardH: 192,
    stageW: 520,
    stageH: 228,
    bleed: 34,
    maxYOffset: 36,
    offsets: DESKTOP_FAN.offsets,
    yOffsets: DESKTOP_FAN.yOffsets,
  });
  const [isFanDragging, setIsFanDragging] = useState(false);
  const [activeCategory, setActiveCategory] =
    useState<ApparelFanCategoryId>("apparel");
  const [activeIndex, setActiveIndex] = useState<number>(FAN_CENTER_INDEX);
  const mobileFanViewportRef = useRef<HTMLDivElement>(null);
  const fanDragStartXRef = useRef(0);
  const didFanDragRef = useRef(false);
  const isFanDraggingRef = useRef(false);
  const activeIndexRef = useRef(FAN_CENTER_INDEX);
  const [preferHover, setPreferHover] = useState(false);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const apply = () => setPreferHover(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const expanded = controlledExpanded ?? internalExpanded;
  const setExpanded = (next: boolean) => {
    setInternalExpanded(next);
    onExpandedChange?.(next);
  };

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
    const next = Math.min(FAN_CENTER_INDEX, Math.max(0, templates.length - 1));
    activeIndexRef.current = next;
    setActiveIndex(next);
  }, [activeCategory, templates.length]);

  useLayoutEffect(() => {
    if (!expanded) return;
    const el = mobileFanViewportRef.current;
    if (!el) return;
    const updateLayout = () => {
      const w = el.clientWidth;
      if (w > 0) setMobileLayout(fitMobileLayout(w));
    };
    updateLayout();
    const ro = new ResizeObserver(updateLayout);
    ro.observe(el);
    return () => ro.disconnect();
  }, [expanded]);

  const goToMobileIndex = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(templates.length - 1, index));
      if (clamped === activeIndexRef.current) return;
      activeIndexRef.current = clamped;
      setActiveIndex(clamped);
    },
    [templates.length],
  );

  const focusFromPointer = useCallback(
    (clientX: number) => {
      const el = mobileFanViewportRef.current;
      if (!el || templates.length <= 1 || isFanDraggingRef.current) return;
      const rect = el.getBoundingClientRect();
      const t = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      goToMobileIndex(Math.round(t * (templates.length - 1)));
    },
    [goToMobileIndex, templates.length],
  );

  const handleFanPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      didFanDragRef.current = false;
      fanDragStartXRef.current = e.clientX;
      isFanDraggingRef.current = true;
      setIsFanDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
      const target = e.currentTarget;

      const handleMove = (ev: PointerEvent) => {
        if (!isFanDraggingRef.current) return;
        if (Math.abs(ev.clientX - fanDragStartXRef.current) > 6) {
          didFanDragRef.current = true;
        }
      };

      const handleUp = (ev: PointerEvent) => {
        if (!isFanDraggingRef.current) return;
        target.releasePointerCapture(ev.pointerId);
        target.removeEventListener("pointermove", handleMove);
        target.removeEventListener("pointerup", handleUp);
        target.removeEventListener("pointercancel", handleUp);
        const delta = ev.clientX - fanDragStartXRef.current;
        if (Math.abs(delta) >= MOBILE_SWIPE_THRESHOLD_PX) {
          if (delta < 0) {
            goToMobileIndex(activeIndexRef.current + 1);
          } else {
            goToMobileIndex(activeIndexRef.current - 1);
          }
        }
        isFanDraggingRef.current = false;
        setIsFanDragging(false);
      };

      target.addEventListener("pointermove", handleMove);
      target.addEventListener("pointerup", handleUp);
      target.addEventListener("pointercancel", handleUp);
    },
    [goToMobileIndex],
  );

  const handleViewportPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!preferHover || isFanDraggingRef.current) return;
      focusFromPointer(e.clientX);
    },
    [focusFromPointer, preferHover],
  );

  const handleMobileWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(delta) < 8) return;
      const next =
        delta > 0
          ? Math.min(activeIndexRef.current + 1, templates.length - 1)
          : Math.max(activeIndexRef.current - 1, 0);
      goToMobileIndex(next);
    },
    [goToMobileIndex, templates.length],
  );

  const handlePick = useCallback(async (item: FanDisplayItem) => {
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
  }, [apiItems, onPicked, router, user]);

  const mobileFanStageHeight = Math.ceil(mobileLayout.stageH * mobileLayout.scale);

  const mobileFanCards = useMemo(
    () =>
      templates.map((template, index) => {
        const { spread, cardW, cardH, offsets, yOffsets } = mobileLayout;
        const rotate = offsets[index] ?? 0;
        const translateY = yOffsets[index] ?? 0;
        const isActive = activeIndex === index;
        const zIndex = isActive ? 35 : 28 - Math.abs(index - FAN_CENTER_INDEX);
        const isPicking = pickingId === template.id;

        return (
          <button
            key={template.id}
            type="button"
            disabled={isPicking}
            onMouseEnter={() => {
              if (preferHover) goToMobileIndex(index);
            }}
            onFocus={() => goToMobileIndex(index)}
            onClick={() => {
              if (didFanDragRef.current) return;
              void handlePick(template);
            }}
            className={`group absolute bottom-0 left-1/2 origin-bottom overflow-hidden rounded-2xl border bg-[#111] transition-[transform,box-shadow,border-color] duration-300 ease-out disabled:opacity-60 ${
              isActive
                ? "border-orange-400/60 shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
                : "border-white/10 shadow-[0_8px_22px_rgba(0,0,0,0.35)]"
            }`}
            style={{
              marginLeft: -cardW / 2,
              width: cardW,
              height: cardH,
              transform: `translate(${(index - FAN_CENTER_INDEX) * spread}px, ${translateY}px) rotate(${rotate}deg) scale(${isActive ? 1.08 : 0.94})`,
              zIndex,
            }}
            aria-label={`选择场景：${template.title}`}
            aria-current={isActive ? "true" : undefined}
          >
            <Image
              src={template.coverUrl}
              alt={template.title}
              fill
              sizes={`${cardW}px`}
              draggable={false}
              className="pointer-events-none object-cover transition duration-500 group-active:scale-[1.03]"
              unoptimized
            />
            {isPicking ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <Loader2 className="size-6 animate-spin text-orange-300" />
              </div>
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-2">
              <p className="text-[7px] uppercase tracking-wider text-orange-300/90 sm:text-[8px]">
                服装
              </p>
              <p className="mt-0.5 text-[10px] font-medium leading-tight text-white sm:text-[11px]">
                {template.title}
              </p>
              <p
                className={`mt-0.5 line-clamp-2 text-[8px] text-zinc-300/90 sm:text-[9px] ${
                  isActive ? "opacity-100" : "opacity-0"
                } transition-opacity duration-200`}
              >
                {template.subtitle}
              </p>
              <div
                className={`mt-1 inline-flex items-center gap-1 text-[8px] font-medium text-orange-300 sm:text-[9px] ${
                  isActive ? "opacity-100" : "opacity-0"
                } transition-opacity duration-200`}
              >
                做同款 <ArrowRight className="size-2.5" />
              </div>
            </div>
          </button>
        );
      }),
    [
      activeIndex,
      goToMobileIndex,
      handlePick,
      mobileLayout,
      pickingId,
      preferHover,
      templates,
    ],
  );

  const desktopFanCards = useMemo(
    () =>
      templates.map((template, index) => {
        const geom = DESKTOP_FAN;
        const rotate = geom.offsets[index] ?? 0;
        const translateY = geom.yOffsets[index] ?? 0;
        const isActive = activeIndex === index;
        const zIndex = isActive ? 35 : 30 - Math.abs(index - FAN_CENTER_INDEX);
        const isPicking = pickingId === template.id;
        return (
          <button
            key={template.id}
            type="button"
            disabled={isPicking}
            onMouseEnter={() => setActiveIndex(index)}
            onFocus={() => setActiveIndex(index)}
            onPointerDown={() => setActiveIndex(index)}
            onClick={() => void handlePick(template)}
            className="group absolute bottom-0 left-1/2 origin-bottom overflow-hidden rounded-2xl border border-white/10 bg-[#111] shadow-[0_12px_32px_rgba(0,0,0,0.45)] transition duration-300 hover:border-orange-400/50 disabled:opacity-60"
            style={{
              marginLeft: -FAN_CARD_W / 2,
              transform: `translate(${(index - FAN_CENTER_INDEX) * geom.spread}px, ${translateY}px) rotate(${rotate}deg) scale(${isActive ? 1.08 : 0.94})`,
              zIndex,
              width: FAN_CARD_W,
              height: FAN_CARD_H,
            }}
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
              <p
                className={`mt-1 line-clamp-2 text-[10px] text-zinc-300/90 ${
                  isActive ? "opacity-100" : "opacity-0"
                } transition`}
              >
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
      }),
    [activeIndex, handlePick, pickingId, templates],
  );

  return (
    <section
      className={`mx-auto w-full max-w-5xl overflow-x-clip px-3 pt-4 max-lg:overflow-x-visible sm:px-4 lg:overflow-visible lg:pt-6 ${className}`}
      aria-label="灵感套图扇形入口"
    >
      <div className="flex flex-col gap-1.5 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-3">
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
        <div className="mt-1.5 lg:mt-3">
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
              {/* 移动端 / PAD：7 张重叠扇形（同 PC），拨动切换高亮 */}
              <div
                ref={mobileFanViewportRef}
                className={`relative mx-auto w-full max-w-full overflow-visible select-none touch-pan-y lg:hidden ${
                  isFanDragging ? "cursor-grabbing" : "cursor-grab"
                }`}
                style={{ height: mobileFanStageHeight }}
                aria-label="灵感套图扇形浏览"
                onPointerDown={handleFanPointerDown}
                onPointerMove={handleViewportPointerMove}
                onWheel={handleMobileWheel}
              >
                <div
                  className="absolute bottom-0 left-1/2"
                  style={{
                    width: mobileLayout.stageW,
                    height: mobileLayout.stageH,
                    transform: `translateX(-50%) scale(${mobileLayout.scale})`,
                    transformOrigin: "bottom center",
                  }}
                >
                  <div
                    className="relative w-full"
                    style={{ height: mobileLayout.cardH }}
                  >
                    {mobileFanCards}
                  </div>
                </div>
              </div>

              <div className="mt-1 flex items-center justify-center gap-1.5 lg:hidden">
                {templates.map((template, index) => (
                  <button
                    key={template.id}
                    type="button"
                    aria-label={`跳到第 ${index + 1} 张：${template.title}`}
                    onClick={() => goToMobileIndex(index)}
                    className={`h-1.5 rounded-full transition-all ${
                      activeIndex === index
                        ? "w-4 bg-orange-400"
                        : "w-1.5 bg-zinc-600"
                    }`}
                  />
                ))}
              </div>

              <div className="hidden lg:block lg:-mx-10 lg:overflow-visible lg:px-10 lg:pb-4">
                <div className="relative mx-auto h-[380px] w-full">
                  <div
                    className="absolute bottom-0 left-1/2 origin-bottom -translate-x-1/2"
                    style={{ width: FAN_STAGE_W }}
                  >
                    <div className="relative h-[300px] w-full">{desktopFanCards}</div>
                  </div>
                </div>
              </div>

              <p className="mt-1.5 text-center text-[10px] text-zinc-500 lg:hidden">
                {preferHover
                  ? "鼠标划过切换高亮 · 点击做同款"
                  : "左右拨动切换高亮 · 轻触做同款"}
              </p>
            </>
          )}
        </div>
      ) : null}

      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
    </section>
  );
}
