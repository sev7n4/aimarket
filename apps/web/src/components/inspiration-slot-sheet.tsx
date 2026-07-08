"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Loader2, Sparkles, X } from "lucide-react";
import type { InspirationDetail } from "@/lib/types";
import { InspirationCoverMedia } from "@/components/inspiration-cover-media";
import {
  renderInspiration,
  copyInspirationToProductionSession,
} from "@/lib/api/inspiration";
import { trackEvent } from "@/lib/api/studio";
import { useAuth } from "@/lib/auth-context";
import {
  applyDramaTemplateToStudio,
  applyInspirationToStudio,
} from "@/lib/inspiration-studio";
import { useRouter } from "next/navigation";

interface InspirationSlotSheetProps {
  detail: InspirationDetail | null;
  open: boolean;
  onClose: () => void;
  onAuthRequired?: () => void;
}

function coverAspectRatio(ratio: string | undefined) {
  const parts = ratio?.split(":").map((n) => Number.parseFloat(n.trim()));
  if (parts?.length === 2 && parts[0]! > 0 && parts[1]! > 0) {
    return `${parts[0]} / ${parts[1]}`;
  }
  return "4 / 5";
}

export function InspirationSlotSheet({
  detail,
  open,
  onClose,
  onAuthRequired,
}: InspirationSlotSheetProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [rendered, setRendered] = useState<InspirationDetail | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!detail || !open) return;
    const initial: Record<string, string> = {};
    for (const v of detail.variables ?? []) {
      initial[v.key] = v.default;
    }
    setValues(initial);
    setRendered(detail);
  }, [detail, open]);

  const renderDebounced = useMemo(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return (id: string, vars: Record<string, string>) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          const data = await renderInspiration(id, vars);
          setRendered(data);
        } catch {
          /* keep previous */
        }
      }, 350);
    };
  }, []);

  useEffect(() => {
    if (!detail || !open) return;
    renderDebounced(detail.id, values);
  }, [detail, open, values, renderDebounced]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  async function handleApplyProductionTemplate() {
    if (!detail?.dramaTemplate) return;
    if (!user) {
      onAuthRequired?.();
      return;
    }
    setSubmitting(true);
    try {
      const { session, dramaTemplate } = await copyInspirationToProductionSession(
        detail.id,
      );
      applyDramaTemplateToStudio(detail, router, {
        sessionId: session.id,
        dramaTemplate,
      });
      void trackEvent("inspiration_copy_to_session", {
        inspirationId: detail.id,
        sessionId: session.id,
        projectType: dramaTemplate.projectType,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApplySameStyle() {
    if (!rendered) return;
    if (!user) {
      onAuthRequired?.();
      return;
    }
    setSubmitting(true);
    try {
      const sessionId = applyInspirationToStudio(rendered, router, {
        variableValues: values,
      });
      void trackEvent("inspiration_apply", {
        inspirationId: rendered.id,
        sessionId,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  if (!open || !detail) return null;

  const aspect = coverAspectRatio(detail.aspectRatio);
  const meta = rendered ?? detail;
  const isVideo = meta.mediaType === "video";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inspiration-slot-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="关闭"
        onClick={onClose}
      />

      <div
        className="relative flex max-h-[min(92dvh,820px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#111] shadow-2xl sm:max-h-[90vh] sm:rounded-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="inspiration-slot-title" className="sr-only">
          {detail.title}
        </h2>

        {/* 移动端：与画廊同比例 + contain，完整展示封面 */}
        <div
          className="relative w-full shrink-0 bg-zinc-950 sm:hidden"
          style={{
            aspectRatio: aspect,
            maxHeight: "min(52dvh, 480px)",
          }}
        >
          <InspirationCoverMedia
            coverUrl={detail.coverUrl}
            title={detail.title}
            mediaType={meta.mediaType}
            videoUrl={detail.videoUrl}
            objectFit="contain"
            interactive
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#111]/85 via-transparent to-black/15" />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full bg-black/50 p-1.5 text-zinc-300 hover:bg-black/70"
            aria-label="关闭"
          >
            <X className="size-4" />
          </button>
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <span className="text-[10px] uppercase tracking-wider text-orange-300/90">
              {detail.category}
            </span>
            <p className="mt-0.5 text-sm font-medium text-white">{detail.title}</p>
          </div>
        </div>

        {/* 桌面端：横幅封面 */}
        <div className="relative hidden aspect-[16/9] w-full shrink-0 bg-zinc-950 sm:block">
          {isVideo ? (
            <InspirationCoverMedia
              coverUrl={detail.coverUrl}
              title={detail.title}
              mediaType="video"
              videoUrl={detail.videoUrl}
              objectFit="cover"
              interactive
            />
          ) : (
            <Image
              src={detail.coverUrl}
              alt={detail.title}
              fill
              className="object-cover"
              unoptimized
            />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#111] via-transparent to-transparent" />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full bg-black/50 px-3 py-1 text-xs text-zinc-300 hover:bg-black/70"
          >
            关闭
          </button>
        </div>

        {/* 可滚动详情区 */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="space-y-4 p-4 sm:p-5">
            <div className="hidden sm:block">
              <p className="text-[10px] uppercase tracking-wider text-orange-400">
                做同款
              </p>
              <p className="text-lg font-semibold text-zinc-100">{detail.title}</p>
              <p className="mt-1 text-xs text-zinc-500">
                填写槽位后预览 Prompt，确认后在 Studio 画布编辑并生成
              </p>
            </div>

            <p className="text-xs text-zinc-500 sm:hidden">
              填写槽位后预览 Prompt，确认后在 Studio 画布编辑并生成
            </p>

            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-zinc-400">
                {meta.modelId}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-zinc-400">
                {meta.aspectRatio}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-zinc-400">
                {meta.resolution.toUpperCase()}
              </span>
            </div>

            {(detail.variables ?? []).length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs font-medium text-zinc-400">模板变量</p>
                {detail.variables!.map((v) => (
                  <label key={v.key} className="block space-y-1">
                    <span className="text-xs text-zinc-500">{v.label}</span>
                    <input
                      type="text"
                      value={values[v.key] ?? v.default}
                      onChange={(e) =>
                        setValues((prev) => ({
                          ...prev,
                          [v.key]: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-orange-500/50"
                    />
                  </label>
                ))}
              </div>
            ) : null}

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">
                预览 Prompt
              </p>
              <p className="max-h-32 overflow-y-auto text-xs leading-relaxed text-zinc-300 sm:max-h-none">
                {rendered?.prompt ?? detail.prompt}
              </p>
            </div>
          </div>
        </div>

        {/* 固定底部 CTA，避免被挤出视口 */}
        <div className="shrink-0 border-t border-white/10 bg-[#111] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-2">
          {detail.dramaTemplate ? (
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleApplyProductionTemplate()}
              data-testid="inspiration-copy-to-production"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-orange-500/40 bg-orange-500/10 px-4 py-2.5 text-sm font-medium text-orange-200 hover:bg-orange-500/20 disabled:opacity-60"
            >
              {submitting ?
                <Loader2 className="size-4 animate-spin" />
              : <Sparkles className="size-4" />}
              用此模板制片
            </button>
          ) : null}
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleApplySameStyle()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-black hover:bg-orange-400 disabled:opacity-60"
          >
            {submitting ?
              <Loader2 className="size-4 animate-spin" />
            : <Sparkles className="size-4" />}
            做同款
          </button>
        </div>
      </div>
    </div>
  );
}
