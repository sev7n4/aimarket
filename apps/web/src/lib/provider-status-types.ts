/** GET /api/v1/ai/providerStatus 完整响应（与 API 对齐） */
export interface ToolProviderStatus {
  mode: string;
  activeProvider: string;
  cutoutProvider: string;
  cutoutMode: string;
  cutoutHttpConfigured: boolean;
  upscaleProvider: string;
  upscaleMode: string;
  upscaleHttpConfigured: boolean;
  enhanceProvider: string;
  expandProvider: string;
  inpaintProvider: string;
  focusEditProvider: string;
  variationProvider: string;
  editMode: string;
  editHttpConfigured: boolean;
  seedreamConfigured: boolean;
  seedreamModel: string;
  genericToolProvider: string;
  usingMock: boolean;
  hint?: string;
}

export interface ProviderStatusPayload {
  mode: string;
  openaiConfigured: boolean;
  aliyunWanConfigured: boolean;
  aliyunWanI2iConfigured?: boolean;
  seedreamConfigured: boolean;
  activeProvider: string;
  usingMock?: boolean;
  hint?: string;
  openaiBaseUrl?: string;
  openaiImageModel?: string;
  aliyunWanBaseUrl?: string;
  aliyunWanModel?: string;
  seedreamBaseUrl?: string;
  seedreamModel?: string;
  tools?: ToolProviderStatus;
  focusPoint?: { provider?: string; configured?: boolean; hint?: string };
  promptOptimize?: { provider?: string; configured?: boolean; hint?: string };
  moderation?: { provider?: string; configured?: boolean; hint?: string };
}
