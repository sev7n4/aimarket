"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Loader2, Sparkles, FolderKanban } from "lucide-react";
import type { InspirationDetail } from "@/lib/types";
import {
  forkInspirationProject,
  renderInspiration,
  trackEvent,
} from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { buildStudioUrl } from "@/lib/studio-navigation";
import { useRouter } from "next/navigation";
import type { AspectRatio } from "@/components/generation-settings-popover";
import type { AppliedInspiration } from "@/lib/inspiration-apply-context";

const ASPECT_RATIOS: AspectRatio[] = [
  "1:1",
  "4:3",
  "3:4",
  "16:9",
  "9:16",
  "3:2",
  "2:3",
  "4:5",
  "5:4",
  "21:9",
];

function coerceAspect(value: string): AspectRatio {
  if (value === "auto" || !value) return "1:1";
  return ASPECT_RATIOS.includes(value as AspectRatio) ?
      (value as AspectRatio)
    : "1:1";
}

interface InspirationSlotSheetProps {
  detail: InspirationDetail | null;
  open: boolean;
  onClose: () => void;
  onApply: (payload: Omit<AppliedInspiration, "applyKey">) => void;
  onAuthRequired?: () => void;
}

export function InspirationSlotSheet({
  detail,
  open,
  onClose,
  onApply,
  onAuthRequired,
}: InspirationSlotSheetProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [rendered, setRendered] = useState<InspirationDetail | null>(null);
  const [submitting, setSubmitting] = useState<"apply" | "project" | null>(
    null,
  );

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

  const buildPayload = useCallback(
    (source: InspirationDetail): Omit<AppliedInspiration, "applyKey"> => ({
      id: source.id,
      title: source.title,
      prompt: source.prompt,
      promptTemplate: source.promptTemplate,
      variables: source.variables,
      modelId: source.modelId,
      aspectRatio: coerceAspect(source.aspectRatio),
      resolution: source.resolution,
      referenceUrls: source.referenceAssets.map((a) => a.url),
    }),
    [],
  );

  async function handleApply() {
    if (!rendered) return;
    setSubmitting("apply");
    try {
      onApply(buildPayload(rendered));
      void trackEvent("inspiration_apply", { inspirationId: rendered.id });
      onClose();
    } finally {
      setSubmitting(null);
    }
  }

  async function handleForkProject() {
    if (!rendered) return;
    if (!user) {
      onAuthRequired?.();
      return;
    }
    setSubmitting("project");
    try {
      const result = await forkInspirationProject(rendered.id, {
        variables: values,
      });
      void trackEvent("inspiration_fork_project", {
        inspirationId: rendered.id,
        sessionId: result.session.id,
      });
      onApply({
        ...buildPayload(result.inspiration),
        forkAsProject: true,
      });
      onClose();
      router.push(
        buildStudioUrl("project", {
          sessionId: result.session.id,
          mode: result.session.mode,
        }),
      );
    } finally {
      setSubmitting(null);
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
              填写槽位后预览 Prompt，可快速生成或 Fork 为交付项目
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

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={!!submitting}
              onClick={() => void handleApply()}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-black hover:bg-orange-400 disabled:opacity-60"
            >
              {submitting === "apply" ?
                <Loader2 className="size-4 animate-spin" />
              : <Sparkles className="size-4" />}
              填入工作台
            </button>
            <button
              type="button"
              disabled={!!submitting}
              onClick={() => void handleForkProject()}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-violet-500/40 bg-violet-500/10 px-4 py-2.5 text-sm font-medium text-violet-200 hover:bg-violet-500/20 disabled:opacity-60"
            >
              {submitting === "project" ?
                <Loader2 className="size-4 animate-spin" />
              : <FolderKanban className="size-4" />}
              Fork 为项目
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
