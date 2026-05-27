"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Loader2, Sparkles } from "lucide-react";
import type { InspirationDetail } from "@/lib/types";
import { renderInspiration, trackEvent } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { randomUUID } from "@/lib/uuid";
import {
  buildInspirationStudioUrl,
  coerceInspirationAspect,
} from "@/lib/inspiration-studio";
import { storePendingInspiration } from "@/lib/pending-inspiration";
import { storePendingAssets } from "@/lib/pending-assets";
import { useRouter } from "next/navigation";

interface InspirationSlotSheetProps {
  detail: InspirationDetail | null;
  open: boolean;
  onClose: () => void;
  onAuthRequired?: () => void;
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

  const buildPendingPayload = useCallback(
    (source: InspirationDetail) => {
      const referenceUrls = source.referenceAssets.map((a) => a.url);
      return {
        id: source.id,
        title: source.title,
        prompt: source.prompt,
        promptTemplate: source.promptTemplate,
        variables: source.variables?.map((v) => ({
          ...v,
          default: values[v.key] ?? v.default,
        })),
        modelId: source.modelId,
        aspectRatio: coerceInspirationAspect(source.aspectRatio),
        resolution: source.resolution,
        referenceUrls,
        variableValues: values,
      };
    },
    [values],
  );

  async function handleApplySameStyle() {
    if (!rendered) return;
    if (!user) {
      onAuthRequired?.();
      return;
    }
    setSubmitting(true);
    try {
      const sessionId = randomUUID();
      const payload = buildPendingPayload(rendered);
      storePendingInspiration(sessionId, payload);
      if (payload.referenceUrls.length > 0) {
        storePendingAssets(
          sessionId,
          payload.referenceUrls.map((url, i) => ({
            id: `insp-ref-${i}`,
            url,
          })),
        );
      }
      void trackEvent("inspiration_apply", {
        inspirationId: rendered.id,
        sessionId,
      });
      onClose();
      router.push(buildInspirationStudioUrl(rendered, sessionId));
    } finally {
      setSubmitting(false);
    }
  }

  if (!open || !detail) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inspiration-slot-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-white/10 bg-[#111] shadow-2xl sm:rounded-2xl">
        <div className="relative aspect-[16/9] w-full bg-zinc-900">
          <Image
            src={detail.coverUrl}
            alt={detail.title}
            fill
            className="object-cover"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#111] via-transparent to-transparent" />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full bg-black/50 px-3 py-1 text-xs text-zinc-300 hover:bg-black/70"
          >
            关闭
          </button>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-orange-400">
              做同款
            </p>
            <h2 id="inspiration-slot-title" className="text-lg font-semibold">
              {detail.title}
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              填写槽位后预览 Prompt，确认后在 Studio 画布编辑并生成
            </p>
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
            <p className="text-xs leading-relaxed text-zinc-300">
              {rendered?.prompt ?? detail.prompt}
            </p>
            {rendered ? (
              <p className="mt-2 text-[10px] text-zinc-600">
                {rendered.modelId} · {rendered.aspectRatio} ·{" "}
                {rendered.resolution.toUpperCase()}
              </p>
            ) : null}
          </div>

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
