"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { LoginDialog } from "@/components/login-dialog";
import { randomUUID } from "@/lib/uuid";
import { trackEvent } from "@/lib/api-client";
import { storePendingInspiration } from "@/lib/pending-inspiration";
import { storePendingAssets } from "@/lib/pending-assets";
import { buildStudioUrl } from "@/lib/studio-navigation";
import {
  SCENARIO_CATEGORIES,
  listScenarioTemplates,
  type ScenarioCategoryId,
  type ScenarioTemplate,
} from "@/lib/scenario-templates";

export interface ScenarioPickPreview {
  id: string;
  title: string;
  coverUrl: string;
}

interface HomeScenarioFanProps {
  className?: string;
  /** 受控展开态：父组件通过工作台灵感按钮触发 */
  expanded?: boolean;
  onExpandedChange?: (next: boolean) => void;
  /** 选择场景后通知父级，用于把缩略图灌到工作台灵感按钮 */
  onPicked?: (pick: ScenarioPickPreview) => void;
  /** 上次选择的场景，用于在折叠态下作为精选预览 */
  lastPick?: ScenarioPickPreview | null;
}

const FAN_OFFSETS_DESKTOP = [-24, -16, -8, 0, 8, 16, 24];
const FAN_Y_OFFSETS_DESKTOP = [40, 22, 8, 0, 8, 22, 40];

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
  const [internalExpanded, setInternalExpanded] = useState(false);
  const expanded = controlledExpanded ?? internalExpanded;
  const setExpanded = (next: boolean) => {
    setInternalExpanded(next);
    onExpandedChange?.(next);
  };

  const [activeCategory, setActiveCategory] =
    useState<ScenarioCategoryId>("apparel");
  const [activeIndex, setActiveIndex] = useState<number>(3);

  const templates = useMemo(
    () => listScenarioTemplates(activeCategory).slice(0, 7),
    [activeCategory],
  );

  useEffect(() => {
    setActiveIndex(3);
  }, [activeCategory]);

  function handlePick(template: ScenarioTemplate) {
    if (!user) {
      setLoginOpen(true);
      return;
    }
    void trackEvent("scenario_pick", {
      scenarioId: template.id,
      category: template.category,
    });
    onPicked?.({
      id: template.id,
      title: template.title,
      coverUrl: template.coverUrl,
    });
    const sessionId = randomUUID();
    storePendingInspiration(sessionId, {
      id: template.id,
      title: template.title,
      prompt: template.prompt,
      modelId: template.modelId,
      aspectRatio: template.aspectRatio,
      resolution: template.resolution,
      referenceUrls: [template.coverUrl],
      variableValues: {},
    });
    storePendingAssets(sessionId, [
      { id: `scenario-${template.id}`, url: template.coverUrl },
    ]);
    router.push(
      buildStudioUrl("project", {
        sessionId,
        mode: "ecommerce",
        title: template.title,
        prompt: template.prompt,
        inspirationId: template.id,
      }),
    );
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
            {SCENARIO_CATEGORIES.map((category) => {
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
          {/* 桌面端（≥lg）：扇形布局 */}
          <div className="relative hidden h-[360px] items-end justify-center lg:flex">
            {templates.map((template, index) => {
              const rotate = FAN_OFFSETS_DESKTOP[index] ?? 0;
              const translateY = FAN_Y_OFFSETS_DESKTOP[index] ?? 0;
              const isActive = activeIndex === index;
              const zIndex = isActive ? 50 : 30 - Math.abs(index - 3);
              return (
                <button
                  key={template.id}
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onFocus={() => setActiveIndex(index)}
                  onClick={() => handlePick(template)}
                  style={{
                    transform: `translate(${(index - 3) * 96}px, ${translateY}px) rotate(${rotate}deg) scale(${isActive ? 1.08 : 0.94})`,
                    zIndex,
                  }}
                  className="group absolute bottom-0 h-[300px] w-[200px] origin-bottom overflow-hidden rounded-2xl border border-white/10 bg-[#111] shadow-[0_12px_32px_rgba(0,0,0,0.45)] transition duration-300 hover:border-orange-400/50"
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

          {/* 移动 + 中屏：横向滑动 */}
          <div className="-mx-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden">
            <div className="flex snap-x snap-mandatory gap-3 px-3">
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handlePick(template)}
                  className="group relative w-[44vw] max-w-[200px] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/10 bg-[#111] shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
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
              ))}
            </div>
            <p className="mt-1 px-3 text-[10px] text-zinc-500">
              左右滑动查看 7 个高频场景
            </p>
          </div>
        </div>
      ) : null}

      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
    </section>
  );
}
