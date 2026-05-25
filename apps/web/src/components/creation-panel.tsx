"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowUp,
  AtSign,
  ChevronDown,
  ImagePlus,
  Loader2,
  Sparkles,
} from "lucide-react";
import {
  Button,
  GlassPanel,
  ModeTabs,
  type CreationMode,
} from "@aimarket/ui";
import { modeTabs, placeholders } from "@/lib/modes";
import {
  estimatePoints,
  fetchModels,
  fetchProductSetInit,
  fetchReferences,
  submitEcommerceGenerate,
  submitGeneration,
  submitVideoGeneration,
  suggestModel,
  uploadAsset,
} from "@/lib/api-client";
import type { ImageModel } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { MentionPicker } from "@/components/mention-picker";
import type { SessionReference } from "@/lib/types";

interface CreationPanelProps {
  initialMode?: CreationMode;
  initialPrompt?: string;
  compact?: boolean;
  sessionId?: string;
  onAuthRequired?: () => void;
  onJobStarted?: (jobId: string) => void;
  navigateOnSubmit?: boolean;
}

export function CreationPanel({
  initialMode = "chat",
  initialPrompt = "",
  compact = false,
  sessionId,
  onAuthRequired,
  onJobStarted,
  navigateOnSubmit = !sessionId,
}: CreationPanelProps) {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<"product" | "reference" | "general">("general");

  const [mode, setMode] = useState<CreationMode>(initialMode);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [brand, setBrand] = useState("");
  const [platform, setPlatform] = useState("淘宝");
  const [market, setMarket] = useState("中国");
  const [language, setLanguage] = useState("中文");
  const [designer, setDesigner] = useState("Gloria");
  const [modelId, setModelId] = useState("omni-v2");
  const [models, setModels] = useState<ImageModel[]>([]);
  const [count, setCount] = useState(1);
  const [resolution, setResolution] = useState("1k");
  const [estimated, setEstimated] = useState<number | null>(null);
  const [routeHint, setRouteHint] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [assetIds, setAssetIds] = useState<string[]>([]);
  const [productAssetId, setProductAssetId] = useState<string | null>(null);
  const [referenceAssetId, setReferenceAssetId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [references, setReferences] = useState<SessionReference[]>([]);
  const [selectedRefs, setSelectedRefs] = useState<SessionReference[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);

  useEffect(() => {
    fetchModels()
      .then(setModels)
      .catch(() => setModels([]));
  }, []);

  useEffect(() => {
    if (mode === "ecommerce") {
      setResolution("2k");
      setCount(4);
      fetchProductSetInit().catch(() => null);
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
      mode === "ecommerce" ? "latest-v2-pro" : modelId;
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
          if (mode === "quick") setModelId(s.modelId);
          setRouteHint(s.reason);
        })
        .catch(() => setRouteHint(null));
    }, 400);
    return () => clearTimeout(t);
  }, [user, mode, prompt]);

  async function handleUpload(files: FileList | null) {
    if (!files?.length || !sessionId) return;
    if (!user) {
      onAuthRequired?.();
      return;
    }
    setUploading(true);
    try {
      const file = files[0];
      const asset = await uploadAsset(file, sessionId);
      if (uploadTargetRef.current === "product") {
        setProductAssetId(asset.id);
      } else if (uploadTargetRef.current === "reference") {
        setReferenceAssetId(asset.id);
      } else {
        setAssetIds((prev) => [...prev, asset.id].slice(0, 4));
      }
    } finally {
      setUploading(false);
      uploadTargetRef.current = "general";
    }
  }

  function openUpload(target: "product" | "reference" | "general") {
    if (!sessionId) {
      onAuthRequired?.();
      return;
    }
    uploadTargetRef.current = target;
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
    if (!prompt.trim() && mode !== "ecommerce") return;
    if (mode === "ecommerce" && prompt.trim().length < 10) {
      alert("请填写至少 10 字的产品信息");
      return;
    }

    if (navigateOnSubmit) {
      const id = crypto.randomUUID();
      const params = new URLSearchParams({ sessionId: id, mode });
      if (prompt.trim()) params.set("q", prompt.trim());
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
      const selectedModel = models.find((m) => m.id === modelId);
      let jobId: string;
      if (selectedModel?.type === "video") {
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
          productAssetId: productAssetId ?? undefined,
          referenceAssetId: referenceAssetId ?? undefined,
        });
        jobId = res.jobId;
        setRouteHint(res.routeReason);
      } else {
        const res = await submitGeneration({
          sessionId,
          prompt: prompt.trim(),
          modelId,
          count,
          resolution,
          mode,
          assetIds: assetIds.length ? assetIds : undefined,
          referenceOutputIds: selectedRefs.map((r) => r.id),
          autoRoute: mode === "quick",
        });
        jobId = res.jobId;
        if (res.routeReason) setRouteHint(res.routeReason);
        if (res.modelId) setModelId(res.modelId);
      }
      setPrompt("");
      setAssetIds([]);
      setSelectedRefs([]);
      await refreshUser();
      onJobStarted?.(jobId);
      if (sessionId) {
        const refs = await fetchReferences(sessionId);
        setReferences(refs);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "提交失败");
    } finally {
      setPending(false);
    }
  }

  const canSubmit =
    mode === "ecommerce" ? prompt.trim().length >= 10 : prompt.trim().length > 0;

  return (
    <GlassPanel
      className={`mx-auto w-full max-w-3xl p-4 sm:p-5 ${compact ? "" : "shadow-orange-500/5"}`}
    >
      <div className="mb-4 flex justify-center overflow-x-auto">
        <ModeTabs items={modeTabs} value={mode} onChange={setMode} />
      </div>

      {mode === "ecommerce" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <UploadSlot
              label={productAssetId ? "产品图 ✓" : "产品图"}
              onClick={() => openUpload("product")}
              loading={uploading}
            />
            <UploadSlot
              label={referenceAssetId ? "参考图 ✓" : "参考图"}
              onClick={() => openUpload("reference")}
            />
          </div>
          <input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="品牌名（可选）"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-orange-500/50"
          />
          <div className="flex flex-wrap gap-2">
            <TagSelect
              value={platform}
              options={["淘宝", "京东", "抖音", "Amazon"]}
              onChange={setPlatform}
            />
            <TagSelect
              value={market}
              options={["中国", "美国", "东南亚"]}
              onChange={setMarket}
            />
            <TagSelect
              value={language}
              options={["中文", "English"]}
              onChange={setLanguage}
            />
            <TagSelect
              value={designer}
              options={["Gloria", "Alex", "Mia"]}
              onChange={setDesigner}
            />
          </div>
          <p className="text-xs text-zinc-500">
            将生成 4 张套图：主图、卖点海报、场景图、详情头图
          </p>
        </div>
      ) : null}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => handleUpload(e.target.files)}
      />

      <div className="relative mt-3">
        <MentionPicker
          references={references}
          open={mentionOpen}
          onSelect={insertMention}
          onClose={() => setMentionOpen(false)}
        />
        <textarea
          value={prompt}
          onChange={(e) => {
            const v = e.target.value;
            setPrompt(v);
            if (v.endsWith("@") && mode === "chat") setMentionOpen(true);
          }}
          placeholder={
            mode === "chat"
              ? "输入修改效果（@ 引用历史图）"
              : placeholders[mode]
          }
          rows={mode === "ecommerce" ? 4 : 2}
          className="w-full resize-none rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-purple-500/40"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void handleSubmit();
            }
          }}
        />
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
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
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
              <ModelSelect
            models={models}
            value={modelId}
            onChange={setModelId}
          />
              <Pill>
                {count} 张
                <ChevronDown className="size-3 opacity-60" />
              </Pill>
            </>
          ) : (
            <Pill>最新图片 V2 Pro · 4 张 · 2K</Pill>
          )}
          <Pill>
            <Sparkles className="size-3 text-orange-400" />
            {mode === "quick" ? "智能路由" : "智能"} ·{" "}
            {mode === "ecommerce" ? "2K" : resolution.toUpperCase()}
            {estimated !== null ? ` · 约 ${estimated} 积分` : ""}
          </Pill>
        </div>
        <Button
          variant="primary"
          className="size-10 rounded-full p-0"
          onClick={() => void handleSubmit()}
          disabled={pending || !canSubmit}
          aria-label="开始生成"
        >
          {pending ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <ArrowUp className="size-5" />
          )}
        </Button>
      </div>
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

function ModelSelect({
  models,
  value,
  onChange,
}: {
  models: ImageModel[];
  value: string;
  onChange: (id: string) => void;
}) {
  const list = models.length
    ? models
    : [{ id: "omni-v2", name: "全能图片 V2", type: "image" } as ImageModel];

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="appearance-none rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300 outline-none"
      aria-label="选择模型"
    >
      {list.filter((m) => m.type === "image").length > 0 ? (
        <optgroup label="图片">
          {list
            .filter((m) => m.type === "image")
            .map((m) => (
              <option key={m.id} value={m.id} className="bg-zinc-900">
                {m.name}
              </option>
            ))}
        </optgroup>
      ) : null}
      {list.filter((m) => m.type === "video").length > 0 ? (
        <optgroup label="视频">
          {list
            .filter((m) => m.type === "video")
            .map((m) => (
              <option key={m.id} value={m.id} className="bg-zinc-900">
                {m.name}
              </option>
            ))}
        </optgroup>
      ) : null}
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
