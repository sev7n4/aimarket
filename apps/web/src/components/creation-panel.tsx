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
  assetUrl,
  ensureSession,
  estimatePoints,
  getToken,
  fetchModels,
  fetchProductSetInit,
  fetchReferences,
  submitEcommerceGenerate,
  submitGeneration,
  submitVideoGeneration,
  suggestModel,
  uploadAsset,
  trackEvent,
  optimizePromptApi,
  reversePromptFromImage,
  renderInspiration,
  executeAgentPlan,
} from "@/lib/api-client";
import { polishPrompt } from "@/lib/prompt-polish";
import { jobStatusLabel } from "@/lib/job-stream";
import type { ImageModel, ProductSetInit, AgentPlan } from "@/lib/types";
import { EcommerceAgentForm } from "@/components/ecommerce-agent-form";
import { AgentPlanPreview } from "@/components/agent-plan-preview";
import { useAuth } from "@/lib/auth-context";
import { MentionPicker } from "@/components/mention-picker";
import type { SessionReference } from "@/lib/types";
import { useRotatingPlaceholder } from "@/hooks/use-rotating-placeholder";
import { randomUUID } from "@/lib/uuid";
import { storePendingAssets, type PendingAsset } from "@/lib/pending-assets";
import { HomeGenerationPreview } from "@/components/home-generation-preview";
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

function coerceAspectRatio(value: string): AspectRatio {
  if (value === "auto" || !value) return "1:1";
  return ASPECT_RATIOS.includes(value as AspectRatio) ?
      (value as AspectRatio)
    : "1:1";
}

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
  /** Studio 父级 SSE/轮询推送的状态（对标椒图进度感） */
  jobStreamStatus?: string | null;
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
  /** Studio 恢复未登录时上传的附件（含预览 URL） */
  restoredAssets?: PendingAsset[];
  /** 首页灵感灌入（由 InspirationApplyProvider 驱动） */
  inspirationApply?: AppliedInspiration | null;
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
  jobStreamStatus = null,
  homeDirectSubmit = false,
  navigateOnSubmit,
  leadingUpload = false,
  enablePolish = false,
  rotatingPlaceholder = false,
  readOnly = false,
  restoredAssets,
  inspirationApply = null,
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
  const [agentPlan, setAgentPlan] = useState<AgentPlan | null>(null);
  const [inspirationVars, setInspirationVars] = useState<
    Record<string, string>
  >({});
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
  const [navigating, setNavigating] = useState(false);
  const [uploadPreviews, setUploadPreviews] = useState<UploadPreviewItem[]>([]);
  const [reversing, setReversing] = useState(false);

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
    if (initialPrompt) setPrompt(initialPrompt);
  }, [initialPrompt]);

  useEffect(() => {
    if (!restoredAssets?.length || !sessionId) return;
    setAssetIds(restoredAssets.map((a) => a.id));
    setUploadPreviews(
      restoredAssets
        .filter((a) => a.url)
        .map((a) => ({
          id: a.id,
          url:
            a.url.startsWith("blob:") || a.url.startsWith("http")
              ? a.url
              : assetUrl(a.url),
        })),
    );
  }, [restoredAssets, sessionId]);

  useEffect(() => {
    if (!inspirationApply) return;
    setPrompt(inspirationApply.prompt);
    setModelId(inspirationApply.modelId);
    setAspectRatio(coerceAspectRatio(inspirationApply.aspectRatio));
    setResolution(inspirationApply.resolution);
    const vars: Record<string, string> = {};
    for (const v of inspirationApply.variables ?? []) {
      vars[v.key] = v.default;
    }
    setInspirationVars(vars);
    if (inspirationApply.referenceUrls.length > 0) {
      setUploadPreviews(
        inspirationApply.referenceUrls.map((url, i) => ({
          id: `insp-${inspirationApply.applyKey}-${i}`,
          url,
        })),
      );
      setAssetIds([]);
    }
  }, [inspirationApply?.applyKey]);

  useEffect(() => {
    if (!inspirationApply?.id || !Object.keys(inspirationVars).length) return;
    const t = setTimeout(() => {
      void renderInspiration(inspirationApply.id, inspirationVars)
        .then((data) => setPrompt(data.prompt))
        .catch(() => {});
    }, 350);
    return () => clearTimeout(t);
  }, [inspirationApply?.id, inspirationVars]);

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
    if (!user || !getToken()) {
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

  async function handlePromptReverse() {
    if (!user || !sessionId) {
      onAuthRequired?.();
      return;
    }
    const assetId = assetIds[0];
    const imageUrl = uploadPreviews[0]?.url;
    if (!assetId && !imageUrl) {
      alert("请先上传参考图");
      return;
    }
    setReversing(true);
    try {
      const data = await reversePromptFromImage({
        sessionId,
        assetId,
        imageUrl: assetId ? undefined : imageUrl,
      });
      setPrompt(data.prompt);
      void trackEvent("prompt_reverse", { source: data.source });
    } catch (err) {
      alert(err instanceof Error ? err.message : "图生文失败");
    } finally {
      setReversing(false);
    }
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
      if (assetIds.length && uploadPreviews.length) {
        storePendingAssets(
          id,
          uploadPreviews.map((p) => ({ id: p.id, url: p.url })),
        );
      } else if (assetIds.length) {
        storePendingAssets(
          id,
          assetIds.map((aid) => ({ id: aid, url: "" })),
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
        const useAgent =
          useAuto &&
          mode === "chat" &&
          agentPlan &&
          (agentPlan.steps.some((s) => s.type === "tool") ||
            agentPlan.requiresConfirm);

        if (useAgent) {
          if (agentPlan.requiresConfirm) {
            const stepText = agentPlan.steps
              .map((s, i) => `${i + 1}. ${s.label}`)
              .join("\n");
            const ok = window.confirm(
              `Agent 将执行以下步骤（约 ${agentPlan.estimatedPoints} 积分）：\n${stepText}\n\n确认执行？`,
            );
            if (!ok) {
              setPending(false);
              return;
            }
          }
          const res = await executeAgentPlan({
            sessionId,
            prompt: prompt.trim(),
            mode,
            modelId: useAuto ? undefined : modelId,
            resolution,
            aspectRatio,
            count,
            confirmed: true,
          });
          jobId = res.jobId;
          if (res.plan.reason) setRouteHint(res.plan.reason);
        } else {
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
        setNavigating(true);
        router.replace(
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
    !jobStreamStatus &&
    (mode === "ecommerce"
      ? prompt.trim().length >= 10 && Boolean(productAssetId)
      : prompt.trim().length > 0);

  const streamBusy =
    Boolean(jobStreamStatus) &&
    jobStreamStatus !== "succeeded" &&
    jobStreamStatus !== "failed";

  const body = (
    <>
      {jobStreamStatus ? (
        <div
          className={`mb-2 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
            jobStreamStatus === "failed"
              ? "border-red-500/30 bg-red-500/5 text-red-300"
              : "border-orange-500/20 bg-orange-500/5 text-orange-200/90"
          }`}
        >
          {streamBusy ? (
            <Loader2 className="size-3.5 shrink-0 animate-spin" />
          ) : null}
          <span>{jobStatusLabel(jobStreamStatus)}</span>
        </div>
      ) : null}

      {inspirationApply && (inspirationApply.variables?.length ?? 0) > 0 ? (
        <div className="mb-3 rounded-xl border border-orange-500/20 bg-orange-500/5 p-3">
          <p className="mb-2 text-xs font-medium text-orange-200/90">
            同款模板 · {inspirationApply.title}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {inspirationApply.variables!.map((v) => (
              <label key={v.key} className="block space-y-1">
                <span className="text-[10px] text-zinc-500">{v.label}</span>
                <input
                  type="text"
                  value={inspirationVars[v.key] ?? v.default}
                  onChange={(e) =>
                    setInspirationVars((prev) => ({
                      ...prev,
                      [v.key]: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-zinc-100 outline-none focus:border-orange-500/40"
                />
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {mode === "chat" && user ? (
        <div className="mb-3">
          <AgentPlanPreview
            prompt={prompt}
            mode={mode}
            enabled={Boolean(user && prompt.trim())}
            onPlanChange={setAgentPlan}
          />
        </div>
      ) : null}

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
              {enablePolish ? (
                <button
                  type="button"
                  title={
                    prompt.trim()
                      ? "润色 Prompt"
                      : "输入描述后可一键润色"
                  }
                  disabled={!prompt.trim()}
                  onClick={() => {
                    const raw = prompt.trim();
                    if (!raw) return;
                    if (user && getToken()) {
                      void optimizePromptApi(raw, mode)
                        .then(setPrompt)
                        .catch(() => setPrompt(polishPrompt(mode, raw)));
                    } else {
                      setPrompt(polishPrompt(mode, raw));
                    }
                  }}
                  className={`absolute bottom-1 right-1 rounded-lg p-1.5 transition ${
                    prompt.trim()
                      ? "text-orange-400 hover:bg-white/10 hover:text-orange-300"
                      : "text-zinc-600 opacity-70"
                  }`}
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
          {enablePolish && (assetIds.length > 0 || uploadPreviews.length > 0) ? (
            <button
              type="button"
              title="根据图片反推 Prompt（图生文）"
              disabled={reversing || streamBusy}
              onClick={() => void handlePromptReverse()}
              className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 disabled:opacity-50"
              aria-label="图生文"
            >
              {reversing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
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
          {estimated !== null && user && getToken() ? (
            <span
              className="inline-flex items-center gap-1 text-xs text-pink-400"
              title="预估本次消耗积分"
            >
              <Sparkles className="size-3.5 fill-pink-400/30" />
              <span className="hidden sm:inline">约</span>
              {estimated}
            </span>
          ) : null}
          <Button
            variant="primary"
            className="size-9 shrink-0 rounded-full p-0 sm:size-10"
            onClick={() => void handleSubmit()}
            disabled={readOnly || pending || streamBusy || !canSubmit}
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
    return (
      <>
        <HomeGenerationPreview open={navigating || (pending && homeDirectSubmit)} />
        <div className="w-full">{body}</div>
      </>
    );
  }

  return (
    <>
      <HomeGenerationPreview open={navigating || (pending && homeDirectSubmit)} />
      <GlassPanel
        className={`mx-auto w-full max-w-3xl p-4 sm:p-5 ${compact ? "" : "shadow-orange-500/5"}`}
      >
        {body}
      </GlassPanel>
    </>
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
