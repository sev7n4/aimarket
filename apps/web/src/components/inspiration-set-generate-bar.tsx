"use client";

import { useEffect, useState } from "react";
import { Loader2, RotateCcw, Sparkles } from "lucide-react";
import {
  executeAgentPlan,
  ensureSession,
  fetchProductSetInit,
  submitVideoGeneration,
  submitEcommerceGenerate,
  submitEcommerceRerunSlide,
} from "@/lib/api-client";
import type { CanvasItem } from "@/lib/canvas-tools";
import { findCanvasItemByRole } from "@/lib/canvas-roles";
import type { StudioInspirationApply } from "@/lib/inspiration-studio";
import type { ProductSetInit } from "@/lib/types";

const ECOMMERCE_SLIDES: Array<{
  key: "main" | "selling" | "scene" | "detail";
  label: string;
  aliases: string[];
}> = [
  { key: "main", label: "电商主图", aliases: ["主图"] },
  { key: "selling", label: "卖点海报", aliases: ["卖点"] },
  { key: "scene", label: "场景展示图", aliases: ["场景"] },
  { key: "detail", label: "详情页头图", aliases: ["详情"] },
];

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
  const [rerunPendingKey, setRerunPendingKey] = useState<string | null>(null);
  const [agentPending, setAgentPending] = useState(false);
  const [videoPending, setVideoPending] = useState(false);
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

  async function handleRerunSlide(
    slide: (typeof ECOMMERCE_SLIDES)[number],
  ) {
    if (readOnly || pending || rerunPendingKey) return;
    if (productInfo.length < 10) {
      setHint("请在工作台填写至少 10 字商品卖点/描述");
      return;
    }
    if (!productItem?.assetId) {
      setHint("请先上传商品图并标记为「商品素材」后再重跑单张");
      return;
    }

    setRerunPendingKey(slide.key);
    setHint(null);
    try {
      await ensureSession(sessionId, "ecommerce", {
        kind: "project",
        title: inspirationApply?.title,
        sourceInspirationId: inspirationApply?.id,
      });
      const res = await submitEcommerceRerunSlide({
        sessionId,
        slideKey: slide.key,
        platform: init?.platforms[0] ?? "淘宝",
        market: init?.markets[0] ?? "中国",
        language: init?.languages[0] ?? "中文",
        productInfo,
        resolution: inspirationApply?.resolution ?? "2k",
        productAssetId: productItem.assetId,
        referenceAssetId: referenceItem?.assetId,
      });
      onJobStarted(res.jobId);
      setHint(`正在重跑「${res.slideLabel}」· 约 ${res.estimatedPoints} 积分`);
    } catch (err) {
      setHint(err instanceof Error ? err.message : "单张重跑失败");
    } finally {
      setRerunPendingKey(null);
    }
  }

  async function handleAgentPipeline() {
    if (readOnly || pending || rerunPendingKey || agentPending) return;
    if (productInfo.length < 10) {
      setHint("请在工作台填写至少 10 字商品卖点/描述");
      return;
    }
    if (!productItem?.assetId) {
      setHint("请先上传商品图并标记为「商品素材」后再执行 Agent 串联");
      return;
    }
    setAgentPending(true);
    setHint(null);
    try {
      await ensureSession(sessionId, "ecommerce", {
        kind: "project",
        title: inspirationApply?.title,
        sourceInspirationId: inspirationApply?.id,
      });
      const res = await executeAgentPlan({
        sessionId,
        prompt: productInfo,
        mode: "ecommerce",
        resolution: inspirationApply?.resolution ?? "2k",
        confirmed: true,
        productAssetId: productItem.assetId,
        referenceAssetId: referenceItem?.assetId,
      });
      onJobStarted(res.jobId);
      setHint(
        `Agent 串联执行中 · ${res.plan.steps.length} 步 · 约 ${res.estimatedPoints} 积分`,
      );
    } catch (err) {
      setHint(err instanceof Error ? err.message : "Agent 串联执行失败");
    } finally {
      setAgentPending(false);
    }
  }

  async function handleGeneratePromoVideo() {
    if (readOnly || pending || rerunPendingKey || agentPending || videoPending) {
      return;
    }
    if (!productItem?.assetId) {
      setHint("请先上传商品图并标记为「商品素材」后再生成宣传短视频");
      return;
    }
    const outputItems = canvasItems.filter((item) => item.role === "output");
    if (outputItems.length < 2) {
      setHint("请先至少生成 2 张套图结果，再生成宣传短视频");
      return;
    }
    const highlights = Array.from(
      new Set(
        outputItems
          .map((item) => item.label)
          .filter((label): label is string => Boolean(label)),
      ),
    );
    const videoPrompt = [
      `基于电商套图素材生成 8 秒宣传短视频，突出商品卖点与转化氛围。`,
      `商品描述：${productInfo || "请根据商品图自动提炼核心卖点"}`,
      highlights.length > 0 ? `可用画面：${highlights.join("、")}` : null,
      `风格：节奏明快、镜头平滑、适合电商投放。`,
      `结尾保留品牌展示和购买引导。`,
    ]
      .filter(Boolean)
      .join("\n");

    setVideoPending(true);
    setHint(null);
    try {
      await ensureSession(sessionId, "ecommerce", {
        kind: "project",
        title: inspirationApply?.title,
        sourceInspirationId: inspirationApply?.id,
      });
      const res = await submitVideoGeneration({
        sessionId,
        prompt: videoPrompt,
        modelId: "seedance-2",
        count: 1,
      });
      onJobStarted(res.jobId);
      setHint(`宣传短视频生成中 · 约 ${res.estimatedPoints} 积分`);
    } catch (err) {
      setHint(err instanceof Error ? err.message : "宣传短视频生成失败");
    } finally {
      setVideoPending(false);
    }
  }

  if (!inspirationApply) return null;

  const ready = productInfo.length >= 10 && Boolean(productItem?.assetId);
  const outputLabels = new Set(
    canvasItems
      .filter((item) => item.role === "output")
      .map((item) => item.label ?? "")
      .filter(Boolean),
  );
  const outputCount = canvasItems.filter((item) => item.role === "output").length;

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
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={readOnly || pending || agentPending || videoPending || !ready}
            onClick={() => void handleGenerateSet()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-orange-500 px-4 py-2 text-xs font-medium text-black hover:bg-orange-400 disabled:opacity-50"
          >
            {pending ?
              <Loader2 className="size-3.5 animate-spin" />
            : <Sparkles className="size-3.5" />}
            生成套图
          </button>
          <button
            type="button"
            disabled={readOnly || pending || agentPending || videoPending || !ready}
            onClick={() => void handleAgentPipeline()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-orange-500/40 bg-black/40 px-3 py-2 text-xs font-medium text-orange-300 hover:border-orange-400/70 disabled:opacity-50"
          >
            {agentPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            Agent 串联
          </button>
          <button
            type="button"
            disabled={
              readOnly ||
              pending ||
              agentPending ||
              videoPending ||
              outputCount < 2 ||
              !productItem?.assetId
            }
            onClick={() => void handleGeneratePromoVideo()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-3 py-2 text-xs font-medium text-zinc-300 hover:border-white/40 disabled:opacity-50"
          >
            {videoPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            生成宣传短视频
          </button>
        </div>
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {ECOMMERCE_SLIDES.map((slide) => {
          const hasOutput =
            outputLabels.has(slide.label) ||
            slide.aliases.some((alias) => outputLabels.has(alias));
          const isPending = rerunPendingKey === slide.key;
          return (
            <button
              key={slide.key}
              type="button"
              onClick={() => void handleRerunSlide(slide)}
              disabled={
                readOnly || pending || agentPending || !!rerunPendingKey || !ready
              }
              className="inline-flex items-center gap-1 rounded-full border border-white/15 px-2.5 py-1 text-[10px] text-zinc-300 hover:border-orange-400/40 disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <RotateCcw className="size-3" />
              )}
              重跑{slide.aliases[0]}
              {hasOutput ? <span className="text-zinc-500">已出图</span> : null}
            </button>
          );
        })}
      </div>
      {hint ? <p className="text-[10px] text-zinc-400">{hint}</p> : null}
    </div>
  );
}
