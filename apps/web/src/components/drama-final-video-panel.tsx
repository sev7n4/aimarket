"use client";

import { useState } from "react";
import { Download, Sparkles } from "lucide-react";
import { CanvasVideoPlayer } from "@/components/canvas-video-player";
import { assetUrl } from "@/lib/api-client";
import { buildDramaPublishPayload } from "@/lib/drama-publish";
import type { DramaRun } from "@/lib/types";

interface DramaFinalVideoPanelProps {
  run: DramaRun;
  busy?: boolean;
  publishedInspirationId?: string | null;
  onPublish?: () => Promise<string | null | undefined>;
  onUnpublish?: (inspirationId: string) => Promise<void>;
}

/** 成片播放器 + 导出 + 灵感发布（PROD-A11） */
export function DramaFinalVideoPanel({
  run,
  busy,
  publishedInspirationId,
  onPublish,
  onUnpublish,
}: DramaFinalVideoPanelProps) {
  const [publishing, setPublishing] = useState(false);
  const [localPublishedId, setLocalPublishedId] = useState<string | null>(
    publishedInspirationId ?? null,
  );

  const videoUrl = run.finalVideoUrl
    ? run.finalVideoUrl.startsWith("http")
      ? run.finalVideoUrl
      : assetUrl(run.finalVideoUrl)
    : null;

  if (!videoUrl) return null;

  const title = run.project.script.title || "AI 短剧成片";
  const publishedId = localPublishedId ?? publishedInspirationId ?? null;

  const handlePublish = async () => {
    if (!onPublish || publishing) return;
    setPublishing(true);
    try {
      buildDramaPublishPayload(run);
      const id = await onPublish();
      if (id) setLocalPublishedId(id);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div
      className="flex min-h-0 flex-1 flex-col rounded-xl border border-emerald-500/25 bg-emerald-500/[0.04] p-3 sm:p-4"
      data-testid="drama-final-video-panel"
    >
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-emerald-200">成片预览</h3>
          <p className="text-[11px] text-zinc-500">{title}</p>
        </div>
        {publishedId ? (
          <span
            className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-300"
            data-testid="drama-inspiration-published-badge"
          >
            已发布灵感
          </span>
        ) : null}
      </header>

      <div className="mx-auto w-full max-w-md flex-1">
        <CanvasVideoPlayer
          url={videoUrl}
          active
          className="w-full overflow-hidden rounded-lg border border-white/10"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={videoUrl}
          download
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5"
          data-testid="drama-final-video-download"
        >
          <Download className="size-3.5" />
          下载 MP4
        </a>
        {onPublish && !publishedId ? (
          <button
            type="button"
            disabled={busy || publishing}
            onClick={() => void handlePublish()}
            className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
            data-testid="drama-publish-inspiration"
          >
            <Sparkles className="size-3.5" />
            {publishing ? "发布中…" : "发布到灵感"}
          </button>
        ) : null}
        {publishedId && onUnpublish ? (
          <button
            type="button"
            disabled={busy || publishing}
            onClick={() =>
              void onUnpublish(publishedId).then(() => setLocalPublishedId(null))
            }
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400 hover:bg-white/5 disabled:opacity-50"
            data-testid="drama-unpublish-inspiration"
          >
            撤回发布
          </button>
        ) : null}
        {publishedId ? (
          <a
            href="/inspiration"
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/10"
            data-testid="drama-inspiration-link"
          >
            查看灵感画廊
          </a>
        ) : null}
      </div>
    </div>
  );
}
