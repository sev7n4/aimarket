"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowUp,
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
  submitGeneration,
  uploadAsset,
} from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

const ecommerceTags = ["淘宝", "中国", "中文"] as const;

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

  const [mode, setMode] = useState<CreationMode>(initialMode);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [brand, setBrand] = useState("");
  const [modelId, setModelId] = useState("omni-v2");
  const [count, setCount] = useState(1);
  const [resolution, setResolution] = useState("1k");
  const [estimated, setEstimated] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [assetIds, setAssetIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) {
      setEstimated(null);
      return;
    }
    estimatePoints(modelId, count, resolution)
      .then(setEstimated)
      .catch(() => setEstimated(null));
  }, [user, modelId, count, resolution]);

  async function handleUpload(files: FileList | null) {
    if (!files?.length || !sessionId) return;
    if (!user) {
      onAuthRequired?.();
      return;
    }
    setUploading(true);
    try {
      const ids: string[] = [];
      for (const file of Array.from(files).slice(0, 4)) {
        const asset = await uploadAsset(file, sessionId);
        ids.push(asset.id);
      }
      setAssetIds((prev) => [...prev, ...ids].slice(0, 4));
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    if (!prompt.trim()) return;

    if (navigateOnSubmit) {
      const id = crypto.randomUUID();
      const params = new URLSearchParams({ sessionId: id, mode });
      params.set("q", prompt.trim());
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
      const { jobId } = await submitGeneration({
        sessionId,
        prompt: prompt.trim(),
        modelId,
        count,
        resolution,
        mode,
        assetIds: assetIds.length ? assetIds : undefined,
      });
      setPrompt("");
      setAssetIds([]);
      await refreshUser();
      onJobStarted?.(jobId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "提交失败");
    } finally {
      setPending(false);
    }
  }

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
              label="产品图"
              onClick={() => fileRef.current?.click()}
              loading={uploading}
            />
            <UploadSlot label="参考图" onClick={() => fileRef.current?.click()} />
          </div>
          <input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="品牌名（可选）"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-orange-500/50"
          />
          <div className="flex flex-wrap gap-2">
            {ecommerceTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => handleUpload(e.target.files)}
      />

      <div className="mt-3">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={placeholders[mode]}
          rows={mode === "ecommerce" ? 4 : 2}
          className="w-full resize-none rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-purple-500/40"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void handleSubmit();
            }
          }}
        />
        {assetIds.length > 0 ? (
          <p className="mt-1 text-xs text-zinc-500">
            已上传 {assetIds.length} 张图片
          </p>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (!sessionId) {
                onAuthRequired?.();
                return;
              }
              fileRef.current?.click();
            }}
            className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
            aria-label="上传图片"
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ImagePlus className="size-4" />
            )}
          </button>
          <ModelSelect value={modelId} onChange={setModelId} />
          <Pill>
            {count} 张
            <ChevronDown className="size-3 opacity-60" />
          </Pill>
          <Pill>
            <Sparkles className="size-3 text-orange-400" />
            智能 · {resolution.toUpperCase()}
            {estimated !== null ? ` · 约 ${estimated} 积分` : ""}
          </Pill>
        </div>
        <Button
          variant="primary"
          className="size-10 rounded-full p-0"
          onClick={() => void handleSubmit()}
          disabled={pending || !prompt.trim()}
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

function ModelSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const [models, setModels] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetchModels()
      .then((list) => setModels(list.map((m) => ({ id: m.id, name: m.name }))))
      .catch(() =>
        setModels([{ id: "omni-v2", name: "全能图片 V2" }]),
      );
  }, []);

  const label = models.find((m) => m.id === value)?.name ?? "全能图片 V2";

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="appearance-none rounded-full border border-white/10 bg-white/5 px-3 py-1.5 pr-7 text-xs text-zinc-300 outline-none"
      aria-label="选择模型"
    >
      {models.map((m) => (
        <option key={m.id} value={m.id} className="bg-zinc-900">
          {m.name}
        </option>
      ))}
      {!models.length ? <option value={value}>{label}</option> : null}
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
