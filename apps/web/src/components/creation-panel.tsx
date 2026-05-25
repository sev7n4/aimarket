"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowUp,
  AtSign,
  ImagePlus,
  Loader2,
  Sparkles,
  Wand2,
} from "lucide-react";
import {
  Button,
  GlassPanel,
  ModeTabs,
  type CreationMode,
} from "@aimarket/ui";
import { modeTabs, placeholders } from "@/lib/modes";
import {
  ensureSession,
  estimatePoints,
  fetchModels,
  fetchProductSetInit,
  fetchReferences,
  submitEcommerceGenerate,
  submitGeneration,
  submitVideoGeneration,
  suggestModel,
  uploadAsset,
  trackEvent,
} from "@/lib/api-client";
import { polishPrompt } from "@/lib/prompt-polish";
import type { ImageModel, ProductSetInit } from "@/lib/types";
import { EcommerceAgentForm } from "@/components/ecommerce-agent-form";
import { useAuth } from "@/lib/auth-context";
import { MentionPicker } from "@/components/mention-picker";
import type { SessionReference } from "@/lib/types";
import { useRotatingPlaceholder } from "@/hooks/use-rotating-placeholder";
import { randomUUID } from "@/lib/uuid";
import {
  UploadPreviewStack,
  type UploadPreviewItem,
} from "@/components/upload-preview-stack";
import {
  GenerationSettingsPopover,
  type AspectRatio,
} from "@/components/generation-settings-popover";
import { ModelPicker, AUTO_MODEL_ID } from "@/components/model-picker";
import { CountPicker } from "@/components/count-picker";

interface CreationPanelProps {
  initialMode?: CreationMode;
  initialPrompt?: string;
  compact?: boolean;
  variant?: "default" | "dock";
  mode?: CreationMode;
  onModeChange?: (mode: CreationMode) => void;
  showModeTabs?: boolean;
  sessionId?: string;
  onAuthRequired?: () => void;
  onJobStarted?: (jobId: string) => void;
  navigateOnSubmit?: boolean;
  /** 首页：左侧虚线上传位 */
  leadingUpload?: boolean;
  /** 首页：Prompt 润色按钮 */
  enablePolish?: boolean;
  /** 登录后首页直接提交并跳转 Studio */
  homeDirectSubmit?: boolean;
  /** 轮播「试试输入：…」占位（对标椒图） */
  rotatingPlaceholder?: boolean;
  /** 团队空间只读：禁止在本会话生成 */
  readOnly?: boolean;
}

export function CreationPanel({
  initialMode = "chat",
  initialPrompt = "",
  compact = false,
  variant = "default",
  mode: controlledMode,
  onModeChange,
  showModeTabs = true,
  sessionId,
  onAuthRequired,
  onJobStarted,
  homeDirectSubmit = false,
  navigateOnSubmit,
  leadingUpload = false,
  enablePolish = false,
  rotatingPlaceholder = false,
  readOnly = false,
}: CreationPanelProps) {
  const shouldNavigateOnSubmit =
    navigateOnSubmit ?? (!sessionId && !homeDirectSubmit);
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<"product" | "reference" | "general">("general");
  const [uploadTarget, setUploadTarget] = useState<
    "product" | "reference" | "general"
  >("general");

  const [internalMode, setInternalMode] = useState<CreationMode>(initialMode);
  const mode = controlledMode ?? internalMode;
  const setMode = (m: CreationMode) => {
    setInternalMode(m);
    onModeChange?.(m);
  };
  const [prompt, setPrompt] = useState(initialPrompt);
  const [brand, setBrand] = useState("");
  const [platform, setPlatform] = useState("淘宝");
  const [market, setMarket] = useState("中国");
  const [language, setLanguage] = useState("中文");
  const [designer, setDesigner] = useState("Gloria");
  const [modelId, setModelId] = useState(AUTO_MODEL_ID);
  const [models, setModels] = useState<ImageModel[]>([]);
  const [count, setCount] = useState(1);
  const [resolution, setResolution] = useState("1k");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [estimated, setEstimated] = useState<number | null>(null);
  const [routeHint, setRouteHint] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [assetIds, setAssetIds] = useState<string[]>([]);
  const [productAssetId, setProductAssetId] = useState<string | null>(null);
  const [referenceAssetId, setReferenceAssetId] = useState<string | null>(null);
  const [productPreviewUrl, setProductPreviewUrl] = useState<string | null>(null);
  const [referencePreviewUrl, setReferencePreviewUrl] = useState<string | null>(
    null,
  );
  const [productSetInit, setProductSetInit] = useState<ProductSetInit | null>(
    null,
  );
  const [uploading, setUploading] = useState(false);
  const [references, setReferences] = useState<SessionReference[]>([]);
  const [selectedRefs, setSelectedRefs] = useState<SessionReference[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [uploadPreviews, setUploadPreviews] = useState<UploadPreviewItem[]>([]);

  const rotatingText = useRotatingPlaceholder(
    mode,
    !rotatingPlaceholder || prompt.trim().length > 0,
  );
  const isDock = variant === "dock";
  const selectedModel =
    modelId === AUTO_MODEL_ID ? undefined : models.find((m) => m.id === modelId);
  const isVideoModel = selectedModel?.type === "video";
  const showStackUpload = (leadingUpload || isDock) && mode !== "ecommerce";

  useEffect(() => {
    fetchModels()
      .then(setModels)
      .catch(() => setModels([]));
  }, []);

  useEffect(() => {
    if (mode === "ecommerce") {
      setResolution("2k");
      setCount(4);
      fetchProductSetInit()
        .then(setProductSetInit)
        .catch(() => setProductSetInit(null));
    } else if (mode === "quick") {
      setCount(1);
    }
  }, [mode]);

  useEffect(() => {
    if (!user || !sessionId) return;
    fetchReferences(sessionId)
      .then(setReferences)
      .catch(() => setReferences([]));
  }, [user, sessionId]);

  useEffect(() => {
    if (!user) {
      setEstimated(null);
      return;
    }
    const effectiveCount = mode === "ecommerce" ? 4 : count;
    const effectiveModel =
      mode === "ecommerce"
        ? "latest-v2-pro"
        : modelId === AUTO_MODEL_ID
          ? "omni-v2"
          : modelId;
    const effectiveRes = mode === "ecommerce" ? "2k" : resolution;
    estimatePoints(effectiveModel, effectiveCount, effectiveRes)
      .then(setEstimated)
      .catch(() => setEstimated(null));
  }, [user, modelId, count, resolution, mode]);

  useEffect(() => {
    if (!user || mode === "ecommerce") return;
    const t = setTimeout(() => {
      suggestModel(mode, prompt)
        .then((s) => {
          if (modelId === AUTO_MODEL_ID) {
            setRouteHint(s.reason ? `Auto → ${s.reason}` : "Auto 路由");
          } else {
            setRouteHint(s.reason);
          }
        })
        .catch(() => setRouteHint(null));
    }, 400);
    return () => clearTimeout(t);
  }, [user, mode, prompt, modelId]);

  async function handleUpload(files: FileList | null) {
    if (!files?.length || !sessionId) return;
    if (!user) {
      onAuthRequired?.();
      return;
    }
    const target = uploadTargetRef.current;
    setUploading(true);
    try {
      if (target === "product") {
        const asset = await uploadAsset(files[0], sessionId);
        setProductAssetId(asset.id);
        setProductPreviewUrl(asset.url);
        return;
      }
      if (target === "reference") {
        const asset = await uploadAsset(files[0], sessionId);
        setReferenceAssetId(asset.id);
        setReferencePreviewUrl(asset.url);
        return;
      }
      const remaining = Math.max(0, 4 - assetIds.length);
      const batch = Array.from(files).slice(0, remaining);
      for (const file of batch) {
        const asset = await uploadAsset(file, sessionId);
        const url = URL.createObjectURL(file);
        setAssetIds((prev) => [...prev, asset.id].slice(0, 4));
        setUploadPreviews((prev) =>
          [...prev, { id: asset.id, url }].slice(0, 4),
        );
      }
    } finally {
      setUploading(false);
      uploadTargetRef.current = "general";
      setUploadTarget("general");
    }
  }

  function openUpload(target: "product" | "reference" | "general") {
    if (!sessionId) {
      onAuthRequired?.();
      return;
    }
    uploadTargetRef.current = target;
    setUploadTarget(target);
    fileRef.current?.click();
  }

  function insertMention(ref: SessionReference) {
    if (!selectedRefs.find((r) => r.id === ref.id)) {
      setSelectedRefs((prev) => [...prev, ref]);
    }
    setPrompt((p) => `${p}${p.endsWith("@") ? "" : " "}@${ref.label} `);
    setMentionOpen(false);
  }

  async function handleSubmit() {
    if (readOnly) return;
    if (!prompt.trim() && mode !== "ecommerce") return;
    if (mode === "ecommerce") {
      if (prompt.trim().length < 10) {
        alert("请填写至少 10 字的产品卖点/描述");
        return;
      }
      if (!productAssetId) {
        alert("请先上传产品图");
        return;
      }
    }

    const shouldNavigate =
      shouldNavigateOnSubmit || (homeDirectSubmit && !user);

    if (shouldNavigate) {
      const id = sessionId ?? randomUUID();
      const params = new URLSearchParams({ sessionId: id, mode });
      if (prompt.trim()) params.set("q", prompt.trim());
      if (assetIds.length) {
        sessionStorage.setItem(
          `aimarket_pending_assets_${id}`,
          JSON.stringify(assetIds),
        );
      }
      router.push(`/studio?${params.toString()}`);
      return;
    }

    if (!user) {
      onAuthRequired?.();
      return;
    }
    if (!sessionId) return;

    setPending(true);
    try {
      await ensureSession(sessionId, mode);
      let jobId: string;
      if (isVideoModel) {
        const res = await submitVideoGeneration({
          sessionId,
          prompt: prompt.trim(),
          modelId,
          count,
        });
        jobId = res.jobId;
      } else if (mode === "ecommerce") {
        const res = await submitEcommerceGenerate({
          sessionId,
          brand: brand || undefined,
          platform,
          market,
          language,
          productInfo: prompt.trim(),
          designer,
          resolution,
          productAssetId: productAssetId ?? undefined,
          referenceAssetId: referenceAssetId ?? undefined,
        });
        jobId = res.jobId;
        setRouteHint(res.routeReason);
        setProductAssetId(null);
        setReferenceAssetId(null);
        setProductPreviewUrl(null);
        setReferencePreviewUrl(null);
      } else {
        const useAuto = modelId === AUTO_MODEL_ID;
        const res = await submitGeneration({
          sessionId,
          prompt: prompt.trim(),
          modelId: useAuto ? undefined : modelId,
          count,
          resolution,
          aspectRatio,
          mode,
          assetIds: assetIds.length ? assetIds : undefined,
          referenceOutputIds: selectedRefs.map((r) => r.id),
          autoRoute: useAuto || mode === "quick",
        });
        jobId = res.jobId;
        if (res.routeReason) setRouteHint(res.routeReason);
        if (res.modelId && useAuto) setModelId(res.modelId);
      }
      setPrompt("");
      setAssetIds([]);
      setUploadPreviews([]);
      setSelectedRefs([]);
      await refreshUser();
      void trackEvent("generation_submit", { mode, sessionId });
      onJobStarted?.(jobId);
      if (sessionId) {
        const refs = await fetchReferences(sessionId);
        setReferences(refs);
      }
      if (homeDirectSubmit) {
        router.push(
          `/studio?sessionId=${sessionId}&mode=${mode}&jobId=${jobId}`,
        );
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "提交失败");
    } finally {
      setPending(false);
    }
  }

  const canSubmit =
    !readOnly &&
    (mode === "ecommerce"
      ? prompt.trim().length >= 10 && Boolean(productAssetId)
      : prompt.trim().length > 0);

  const body = (
    <>
      {showModeTabs && variant === "default" ? (
        <div className="mb-4 flex justify-center overflow-x-auto">
          <ModeTabs items={modeTabs} value={mode} onChange={setMode} />
        </div>
      ) : null}

      {mode === "ecommerce" ? (
        <EcommerceAgentForm
          init={productSetInit}
          brand={brand}
          onBrandChange={setBrand}
          platform={platform}
          onPlatformChange={setPlatform}
          market={market}
          onMarketChange={setMarket}
          language={language}
          onLanguageChange={setLanguage}
          designer={designer}
          onDesignerChange={setDesigner}
          resolution={resolution}
          onResolutionChange={setResolution}
          productPreviewUrl={productPreviewUrl}
          referencePreviewUrl={referencePreviewUrl}
          uploading={uploading}
          onUploadProduct={() => openUpload("product")}
          onUploadReference={() => openUpload("reference")}
          onClearProduct={() => {
            setProductAssetId(null);
            setProductPreviewUrl(null);
          }}
          onClearReference={() => {
            setReferenceAssetId(null);
            setReferencePreviewUrl(null);
          }}
        />
      ) : null}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={uploadTarget === "general"}
        className="hidden"
        onChange={(e) => {
          void handleUpload(e.target.files);
          e.target.value = "";
        }}
      />

      <div className={`relative ${isDock ? "" : "mt-3"}`}>
        <MentionPicker
          references={references}
          open={mentionOpen}
          onSelect={insertMention}
          onClose={() => setMentionOpen(false)}
        />
        <div
          className={
            isDock
              ? "rounded-2xl border border-white/10 bg-[#141414] px-3 pb-3 pt-3 sm:px-4 sm:pt-4"
              : ""
          }
        >
          <div className="relative flex gap-3">
            {showStackUpload ? (
              <UploadPreviewStack
                items={uploadPreviews}
                uploading={uploading}
                onAdd={() => openUpload("general")}
                onRemove={(id) => {
                  setUploadPreviews((prev) => prev.filter((p) => p.id !== id));
                  setAssetIds((prev) => prev.filter((a) => a !== id));
                }}
              />
            ) : null}
            <div className="relative min-w-0 flex-1">
              <textarea
                value={prompt}
                onChange={(e) => {
                  const v = e.target.value;
                  setPrompt(v);
                  if (v.endsWith("@") && mode === "chat") setMentionOpen(true);
                }}
                placeholder={
                  rotatingPlaceholder && !prompt.trim()
                    ? rotatingText
                    : mode === "ecommerce"
                      ? placeholders.ecommerce
                      : mode === "chat"
                        ? "输入您想要的修改效果（@ 选择生成图片）"
                        : placeholders[mode]
                }
                rows={mode === "ecommerce" ? 3 : isDock ? 2 : 2}
                readOnly={readOnly}
                className={`w-full resize-none bg-transparent text-sm outline-none placeholder:text-zinc-600 ${
                  readOnly ? "cursor-not-allowed opacity-60" : ""
                } ${
                  isDock
                    ? "min-h-[56px] pr-9 text-zinc-100"
                    : "rounded-2xl border border-white/10 bg-black/40 px-4 py-3 focus:border-purple-500/40"
                }`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void handleSubmit();
                  }
                }}
              />
              {enablePolish && prompt.trim().length > 0 ? (
                <button
                  type="button"
                  title="润色 Prompt"
                  onClick={() =>
                    setPrompt((p) => polishPrompt(mode, p.trim()))
                  }
                  className="absolute bottom-1 right-1 rounded-lg p-1.5 text-zinc-500 hover:bg-white/10 hover:text-orange-300"
                  aria-label="润色描述"
                >
                  <Wand2 className="size-4" />
                </button>
              ) : null}
            </div>
          </div>
        {selectedRefs.length > 0 ? (
          <p className="mt-1 text-xs text-purple-400">
            已引用 {selectedRefs.length} 张历史图
          </p>
        ) : null}
        {assetIds.length > 0 ? (
          <p className="mt-1 text-xs text-zinc-500">
            已上传 {assetIds.length} 张附件
          </p>
        ) : null}
        {routeHint ? (
          <p className="mt-1 text-xs text-orange-400/80">路由：{routeHint}</p>
        ) : null}

          <div
            className={`flex items-center justify-between gap-2 ${isDock ? "mt-3" : "mt-3"}`}
          >
        <div
          className={
            isDock
              ? "flex min-w-0 flex-1 items-center gap-2 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              : "flex flex-wrap items-center gap-2"
          }
        >
          {!showStackUpload ? (
            <button
              type="button"
              onClick={() => openUpload("general")}
              className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
              aria-label="上传图片"
            >
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ImagePlus className="size-4" />
              )}
            </button>
          ) : null}
          {mode === "chat" && sessionId ? (
            <button
              type="button"
              onClick={() => setMentionOpen((o) => !o)}
              className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
              aria-label="引用历史图"
            >
              <AtSign className="size-4" />
            </button>
          ) : null}
          {mode !== "ecommerce" ? (
            <>
              <ModelPicker
                models={models}
                value={modelId}
                onChange={setModelId}
              />
              <CountPicker value={count} onChange={setCount} max={4} />
            </>
          ) : (
            <Pill>最新图片 V2 Pro · 4 张 · 2K</Pill>
          )}
          {mode === "ecommerce" ? (
            <Pill>
              智能 · {resolution.toUpperCase()} · 1:1 套图
            </Pill>
          ) : (
            <GenerationSettingsPopover
              mode={mode}
              resolution={resolution}
              aspectRatio={aspectRatio}
              onResolutionChange={setResolution}
              onAspectRatioChange={setAspectRatio}
              videoMode={isVideoModel}
            />
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {estimated !== null && user ? (
            <span className="inline-flex items-center gap-1 text-xs text-pink-400">
              <Sparkles className="size-3.5 fill-pink-400/30" />
              {estimated}
            </span>
          ) : null}
          <Button
            variant="primary"
            className="size-9 shrink-0 rounded-full p-0 sm:size-10"
            onClick={() => void handleSubmit()}
            disabled={readOnly || pending || !canSubmit}
            aria-label="开始生成"
          >
            {pending ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <ArrowUp className="size-5" />
            )}
          </Button>
        </div>
          </div>
        </div>
      </div>
    </>
  );

  if (isDock) {
    return <div className="w-full">{body}</div>;
  }

  return (
    <GlassPanel
      className={`mx-auto w-full max-w-3xl p-4 sm:p-5 ${compact ? "" : "shadow-orange-500/5"}`}
    >
      {body}
    </GlassPanel>
  );
}

function TagSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300 outline-none"
    >
      {options.map((o) => (
        <option key={o} value={o} className="bg-zinc-900">
          {o}
        </option>
      ))}
    </select>
  );
}

function UploadSlot({
  label,
  onClick,
  loading,
}: {
  label: string;
  onClick?: () => void;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-white/15 bg-black/30 text-xs text-zinc-400 transition hover:border-orange-500/40 hover:bg-white/5"
    >
      {loading ? (
        <Loader2 className="size-5 animate-spin" />
      ) : (
        <ImagePlus className="size-5" />
      )}
      {label}
    </button>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300">
      {children}
    </span>
  );
}
