"use client";

import { ImagePlus, Loader2, X } from "lucide-react";
import { assetUrl } from "@/lib/api-client";
import type { ProductSetInit } from "@/lib/types";

interface EcommerceAgentFormProps {
  init: ProductSetInit | null;
  brand: string;
  onBrandChange: (v: string) => void;
  platform: string;
  onPlatformChange: (v: string) => void;
  market: string;
  onMarketChange: (v: string) => void;
  language: string;
  onLanguageChange: (v: string) => void;
  designer: string;
  onDesignerChange: (v: string) => void;
  resolution: string;
  onResolutionChange: (v: string) => void;
  productPreviewUrl: string | null;
  referencePreviewUrl: string | null;
  uploading: boolean;
  onUploadProduct: () => void;
  onUploadReference: () => void;
  onClearProduct: () => void;
  onClearReference: () => void;
}

export function EcommerceAgentForm({
  init,
  brand,
  onBrandChange,
  platform,
  onPlatformChange,
  market,
  onMarketChange,
  language,
  onLanguageChange,
  designer,
  onDesignerChange,
  resolution,
  onResolutionChange,
  productPreviewUrl,
  referencePreviewUrl,
  uploading,
  onUploadProduct,
  onUploadReference,
  onClearProduct,
  onClearReference,
}: EcommerceAgentFormProps) {
  const platforms = init?.platforms ?? ["淘宝", "京东", "抖音", "Amazon"];
  const markets = init?.markets ?? ["中国", "美国", "东南亚"];
  const languages = init?.languages ?? ["中文", "English"];
  const designers = init?.designers ?? ["Gloria", "Alex", "Mia"];

  return (
    <div className="space-y-3 rounded-xl border border-orange-500/20 bg-orange-500/5 p-3">
      <p className="text-xs font-medium text-orange-200/90">电商套图 Agent</p>

      <div className="flex flex-wrap gap-3">
        <AssetSlot
          label="产品图"
          required
          previewUrl={productPreviewUrl}
          uploading={uploading}
          onPick={onUploadProduct}
          onClear={onClearProduct}
        />
        <AssetSlot
          label="参考排版"
          previewUrl={referencePreviewUrl}
          uploading={uploading}
          onPick={onUploadReference}
          onClear={onClearReference}
        />
      </div>

      <input
        value={brand}
        onChange={(e) => onBrandChange(e.target.value)}
        placeholder="品牌名（可选）"
        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-orange-500/50"
      />

      <div className="flex flex-wrap gap-2">
        <TagSelect value={platform} options={platforms} onChange={onPlatformChange} />
        <TagSelect value={market} options={markets} onChange={onMarketChange} />
        <TagSelect value={language} options={languages} onChange={onLanguageChange} />
        <TagSelect value={designer} options={designers} onChange={onDesignerChange} />
        <TagSelect
          value={resolution}
          options={["1k", "2k", "4k"]}
          onChange={onResolutionChange}
        />
      </div>

      <p className="text-xs text-zinc-500">
        将生成 4 张套图：主图、卖点海报、场景图、详情头图（需上传产品图 + 卖点文案 ≥10 字）
      </p>
    </div>
  );
}

function AssetSlot({
  label,
  required,
  previewUrl,
  uploading,
  onPick,
  onClear,
}: {
  label: string;
  required?: boolean;
  previewUrl: string | null;
  uploading: boolean;
  onPick: () => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] text-zinc-500">
        {label}
        {required ? <span className="text-orange-400"> *</span> : null}
      </span>
      {previewUrl ? (
        <div className="relative size-20 overflow-hidden rounded-xl border border-white/15">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={assetUrl(previewUrl)}
            alt={label}
            className="size-full object-cover"
          />
          <button
            type="button"
            onClick={onClear}
            className="absolute right-0.5 top-0.5 rounded-full bg-black/70 p-0.5 text-zinc-300 hover:text-white"
          >
            <X className="size-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onPick}
          disabled={uploading}
          className="flex size-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/20 bg-black/30 text-zinc-500 hover:border-orange-500/40 hover:text-zinc-300"
        >
          {uploading ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <ImagePlus className="size-5" />
          )}
          <span className="text-[10px]">上传</span>
        </button>
      )}
    </div>
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
      className="rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-xs text-zinc-300 outline-none"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
