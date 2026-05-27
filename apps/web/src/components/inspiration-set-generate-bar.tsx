"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import {
  ensureSession,
  fetchProductSetInit,
  submitEcommerceGenerate,
} from "@/lib/api-client";
import type { CanvasItem } from "@/lib/canvas-tools";
import { findCanvasItemByRole } from "@/lib/canvas-roles";
import type { StudioInspirationApply } from "@/lib/inspiration-studio";
import type { ProductSetInit } from "@/lib/types";

interface InspirationSetGenerateBarProps {
  sessionId: string;
  canvasItems: CanvasItem[];
  prompt: string;
  inspirationApply?: StudioInspirationApply | null;
  readOnly?: boolean;
  onJobStarted: (jobId: string) => void;
}

export function InspirationSetGenerateBar({
  sessionId,
  canvasItems,
  prompt,
  inspirationApply,
  readOnly = false,
  onJobStarted,
}: InspirationSetGenerateBarProps) {
  const [init, setInit] = useState<ProductSetInit | null>(null);
  const [pending, setPending] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const productItem = findCanvasItemByRole(canvasItems, "product");
  const referenceItem = findCanvasItemByRole(canvasItems, "reference");
  const productInfo = prompt.trim();

  useEffect(() => {
    void fetchProductSetInit()
      .then(setInit)
      .catch(() => setInit(null));
  }, []);

  async function handleGenerateSet() {
    if (readOnly || pending) return;
    if (productInfo.length < 10) {
      setHint("请在工作台填写至少 10 字商品卖点/描述");
      return;
    }
    if (!productItem?.assetId) {
      setHint("请上传商品图并标记为「商品素材」，或点选画布图片设为商品素材");
      return;
    }

    setPending(true);
    setHint(null);
    try {
      await ensureSession(sessionId, "ecommerce", {
        kind: "project",
        title: inspirationApply?.title,
        sourceInspirationId: inspirationApply?.id,
      });
      const res = await submitEcommerceGenerate({
        sessionId,
        platform: init?.platforms[0] ?? "淘宝",
        market: init?.markets[0] ?? "中国",
        language: init?.languages[0] ?? "中文",
        productInfo,
        resolution: inspirationApply?.resolution ?? "2k",
        productAssetId: productItem.assetId,
        referenceAssetId: referenceItem?.assetId,
      });
      onJobStarted(res.jobId);
      setHint(`套图生成中 · 约 ${res.estimatedPoints} 积分 · ${res.slideCount} 张`);
    } catch (err) {
      setHint(err instanceof Error ? err.message : "套图生成失败");
    } finally {
      setPending(false);
    }
  }

  if (!inspirationApply) return null;

  const ready = productInfo.length >= 10 && Boolean(productItem?.assetId);

  return (
    <div className="mx-1 mb-3 rounded-xl border border-orange-500/25 bg-orange-500/5 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-orange-200/90">
            同款套图 · 一键生成 4 张成品
          </p>
          <p className="mt-0.5 text-[10px] text-zinc-500">
            {referenceItem
              ? "已绑定套图参考 + 商品素材"
              : "建议标记一张「套图参考」与一张「商品素材」"}
          </p>
        </div>
        <button
          type="button"
          disabled={readOnly || pending || !ready}
          onClick={() => void handleGenerateSet()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-orange-500 px-4 py-2 text-xs font-medium text-black hover:bg-orange-400 disabled:opacity-50"
        >
          {pending ?
            <Loader2 className="size-3.5 animate-spin" />
          : <Sparkles className="size-3.5" />}
          生成套图
        </button>
      </div>
      {hint ? <p className="text-[10px] text-zinc-400">{hint}</p> : null}
    </div>
  );
}
