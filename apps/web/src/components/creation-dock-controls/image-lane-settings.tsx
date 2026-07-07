"use client";

import { ModelPicker } from "@/components/model-picker";
import { CountPicker } from "@/components/count-picker";
import {
  GenerationSettingsPopover,
  type AspectRatio,
} from "@/components/generation-settings-popover";
import type { ImageModel } from "@/lib/types";

interface ImageDockSettingsProps {
  models: ImageModel[];
  modelId: string;
  onModelChange: (id: string) => void;
  count: number;
  onCountChange: (n: number) => void;
  resolution: string;
  aspectRatio: AspectRatio;
  onResolutionChange: (v: string) => void;
  onAspectRatioChange: (v: AspectRatio) => void;
  disabled?: boolean;
}

export function ImageDockSettings({
  models,
  modelId,
  onModelChange,
  count,
  onCountChange,
  resolution,
  aspectRatio,
  onResolutionChange,
  onAspectRatioChange,
  disabled = false,
}: ImageDockSettingsProps) {
  const imageModels = models.filter((m) => m.type === "image");

  return (
    <>
      <div className={disabled ? "pointer-events-none opacity-50" : undefined}>
        <ModelPicker
          models={imageModels.length ? imageModels : models}
          value={modelId}
          onChange={onModelChange}
        />
      </div>
      <div className={disabled ? "pointer-events-none opacity-50" : undefined}>
        <GenerationSettingsPopover
          mode="chat"
          resolution={resolution}
          aspectRatio={aspectRatio}
          onResolutionChange={onResolutionChange}
          onAspectRatioChange={onAspectRatioChange}
        />
      </div>
      <div className={disabled ? "pointer-events-none opacity-50" : undefined}>
        <CountPicker value={count} onChange={onCountChange} max={4} />
      </div>
    </>
  );
}