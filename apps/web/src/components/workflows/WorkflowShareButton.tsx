"use client";

import { useCallback, useEffect, useState } from "react";
import { Link2, Loader2 } from "lucide-react";
import {
  getStoryCanvasShareStatus,
  toggleStoryCanvasShare,
} from "@/lib/api/story-canvas-share";

type WorkflowShareButtonProps = {
  sessionId?: string;
};

export function WorkflowShareButton({ sessionId }: WorkflowShareButtonProps) {
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    void getStoryCanvasShareStatus(sessionId)
      .then((status) => {
        setActive(status.active);
      })
      .catch(() => setActive(false));
  }, [sessionId]);

  const handleToggle = useCallback(async () => {
    if (!sessionId || loading) return;
    setLoading(true);
    try {
      const next = !active;
      const result = await toggleStoryCanvasShare({
        sessionId,
        enabled: next,
      });
      setActive(result.enabled);
      if (result.shareUrl) {
        setShareUrl(result.shareUrl);
        await navigator.clipboard.writeText(result.shareUrl);
      } else {
        setShareUrl(null);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [sessionId, active, loading]);

  if (!sessionId) return null;

  return (
    <button
      type="button"
      onClick={() => void handleToggle()}
      disabled={loading}
      className={`absolute right-3 top-[9.75rem] z-20 inline-flex size-8 items-center justify-center rounded-md border transition ${
        active ? "bg-emerald-500/20 text-emerald-300" : "bg-black/40 text-zinc-300 hover:bg-black/60"
      }`}
      style={{ borderColor: "rgba(255,255,255,0.15)" }}
      aria-label="分享工作流"
      title={active ? (shareUrl ? "已复制分享链接" : "分享已开启") : "开启分享"}
      data-testid="workflow-share-toggle"
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
    </button>
  );
}
