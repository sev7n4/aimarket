/**
 * OpenAI Images API 标准接口参数定义
 * 
 * 参考文档：
 * - Generations: POST /images/generations
 * - Edits: POST /images/edits (inpainting)
 * - Variations: POST /images/variations
 */

export interface GenerateParams {
  prompt: string;
  modelId: string;
  count: number;
  resolution: string;
  aspectRatio?: string;
  referenceUrls?: string[];
}

export interface EditParams {
  prompt: string;
  modelId: string;
  image: string;
  mask?: string;
  count: number;
  resolution: string;
  aspectRatio?: string;
}

export interface VariationParams {
  modelId: string;
  image: string;
  count: number;
  resolution: string;
  aspectRatio?: string;
}

export interface GenerateResult {
  urls: string[];
  provider: string;
}

export type ImageOperation = 'generate' | 'edit' | 'variation';

export interface ImageProvider {
  name: string;
  supports(modelId: string, operation?: ImageOperation): boolean;
  generate(params: GenerateParams): Promise<GenerateResult>;
  edit?(params: EditParams): Promise<GenerateResult>;
  variation?(params: VariationParams): Promise<GenerateResult>;
}
