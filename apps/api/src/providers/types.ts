/**
 * OpenAI Images API 标准接口参数定义
 * 
 * 参考文档：
 * - Generations: POST /images/generations
 * - Edits: POST /images/edits (inpainting)
 * - Variations: POST /images/variations
 */

export interface ImageRouteContext {
  hasReferenceImages?: boolean;
  userId?: string;
}

export interface GenerateParams {
  prompt: string;
  modelId: string;
  count: number;
  resolution: string;
  aspectRatio?: string;
  referenceUrls?: string[];
  /** 启用 BYOK 时使用该用户的加密 Key */
  userId?: string;
  /** 创作台 Auto：允许跨 Provider 回落；指定模型时为 false */
  autoRoute?: boolean;
  routingMode?: "auto" | "explicit" | "byok";
  qualityTier?: "standard" | "pro";
}

export interface EditParams {
  prompt: string;
  modelId: string;
  image: string;
  mask?: string;
  count: number;
  resolution: string;
  aspectRatio?: string;
  userId?: string;
}

export interface VariationParams {
  modelId: string;
  image: string;
  count: number;
  resolution: string;
  aspectRatio?: string;
  userId?: string;
}

export interface GenerateResult {
  urls: string[];
  provider: string;
}

export type ImageOperation = 'generate' | 'edit' | 'variation';

export interface ImageProvider {
  name: string;
  supports(
    modelId: string,
    operation?: ImageOperation,
    context?: ImageRouteContext,
  ): boolean;
  generate(params: GenerateParams): Promise<GenerateResult>;
  edit?(params: EditParams): Promise<GenerateResult>;
  variation?(params: VariationParams): Promise<GenerateResult>;
}
