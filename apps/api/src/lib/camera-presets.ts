/**
 * 大师运镜预设数据
 *
 * 定义 12 种经典运镜预设，每种包含摄像机参数和视频 prompt 后缀。
 * 前端通过选择器 UI 展示，后端通过 applyCameraPreset 将预设附加到视频生成 prompt。
 */

/** 运镜预设接口 */
export interface CameraPreset {
  id: string;
  /** 中文名称 */
  name: string;
  /** 英文名称 */
  nameEn: string;
  /** 简短描述 */
  description: string;
  /** 映射到 CameraParams */
  camera: { tilt: number; pan: number; fov: string };
  /** 映射到视频 prompt 的运镜描述 */
  promptSuffix: string;
}

/** 12 种运镜预设 */
export const CAMERA_PRESETS: CameraPreset[] = [
  {
    id: "push",
    name: "推镜头",
    nameEn: "Push In",
    description: "从远处缓慢推向主体",
    camera: { tilt: 0, pan: 0, fov: "full" },
    promptSuffix: "镜头缓慢向主体推进，从全景推至近景",
  },
  {
    id: "pull",
    name: "拉镜头",
    nameEn: "Pull Out",
    description: "从近处缓慢拉远",
    camera: { tilt: 0, pan: 0, fov: "close-shot" },
    promptSuffix: "镜头缓慢从近景拉远至全景",
  },
  {
    id: "pan-left",
    name: "左摇",
    nameEn: "Pan Left",
    description: "镜头水平向左摇",
    camera: { tilt: 0, pan: -30, fov: "medium" },
    promptSuffix: "镜头水平向左缓慢摇动",
  },
  {
    id: "pan-right",
    name: "右摇",
    nameEn: "Pan Right",
    description: "镜头水平向右摇",
    camera: { tilt: 0, pan: 30, fov: "medium" },
    promptSuffix: "镜头水平向右缓慢摇动",
  },
  {
    id: "tilt-up",
    name: "上摇",
    nameEn: "Tilt Up",
    description: "镜头从下向上仰拍",
    camera: { tilt: -30, pan: 0, fov: "medium" },
    promptSuffix: "镜头从低处缓慢向上仰拍",
  },
  {
    id: "tilt-down",
    name: "下摇",
    nameEn: "Tilt Down",
    description: "镜头从上向下俯拍",
    camera: { tilt: 30, pan: 0, fov: "medium" },
    promptSuffix: "镜头从高处缓慢向下俯拍",
  },
  {
    id: "orbit",
    name: "环绕",
    nameEn: "Orbit",
    description: "镜头围绕主体旋转",
    camera: { tilt: 0, pan: 0, fov: "medium" },
    promptSuffix: "镜头围绕主体做360度环绕运动",
  },
  {
    id: "whip",
    name: "甩镜头",
    nameEn: "Whip Pan",
    description: "快速水平甩镜头",
    camera: { tilt: 0, pan: 60, fov: "medium" },
    promptSuffix: "镜头快速水平甩动，产生运动模糊",
  },
  {
    id: "dolly",
    name: "移动",
    nameEn: "Dolly",
    description: "镜头水平移动跟随主体",
    camera: { tilt: 0, pan: 0, fov: "medium" },
    promptSuffix: "镜头水平平稳移动，跟随主体运动",
  },
  {
    id: "zoom",
    name: "变焦",
    nameEn: "Zoom",
    description: "镜头从广角变焦到长焦",
    camera: { tilt: 0, pan: 0, fov: "full" },
    promptSuffix: "镜头从广角缓慢变焦到长焦，压缩空间感",
  },
  {
    id: "crane-up",
    name: "升镜头",
    nameEn: "Crane Up",
    description: "镜头从低处升高",
    camera: { tilt: -20, pan: 0, fov: "wide" },
    promptSuffix: "镜头从低处缓慢升高，呈现壮阔全景",
  },
  {
    id: "crane-down",
    name: "降镜头",
    nameEn: "Crane Down",
    description: "镜头从高处降低",
    camera: { tilt: 20, pan: 0, fov: "close-shot" },
    promptSuffix: "镜头从高处缓慢降低，聚焦主体",
  },
];

/**
 * 运镜参数 → 视频生成 prompt 映射
 *
 * 找到指定预设，将 promptSuffix 附加到 basePrompt 末尾。
 * @param presetId 运镜预设 ID
 * @param basePrompt 原始视频生成 prompt
 * @returns 附加运镜描述后的 prompt
 */
export function applyCameraPreset(presetId: string, basePrompt: string): string {
  const preset = CAMERA_PRESETS.find((p) => p.id === presetId);
  if (!preset) return basePrompt;
  return `${basePrompt}, ${preset.promptSuffix}`;
}
