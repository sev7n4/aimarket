/** 大师运镜预设（与 apps/api/src/lib/camera-presets.ts 同步） */
export type MasterCameraPreset = {
  id: string;
  name: string;
  promptSuffix: string;
};

export const MASTER_CAMERA_PRESETS: MasterCameraPreset[] = [
  { id: "push", name: "推镜头", promptSuffix: "镜头缓慢向主体推进，从全景推至近景" },
  { id: "pull", name: "拉镜头", promptSuffix: "镜头缓慢从近景拉远至全景" },
  { id: "pan-left", name: "左摇", promptSuffix: "镜头水平向左缓慢摇动" },
  { id: "pan-right", name: "右摇", promptSuffix: "镜头水平向右缓慢摇动" },
  { id: "tilt-up", name: "上摇", promptSuffix: "镜头从低处缓慢向上仰拍" },
  { id: "tilt-down", name: "下摇", promptSuffix: "镜头从高处缓慢向下俯拍" },
  { id: "orbit", name: "环绕", promptSuffix: "镜头围绕主体做360度环绕运动" },
  { id: "whip", name: "甩镜头", promptSuffix: "快速甩镜转场，动感强烈" },
  { id: "dolly", name: "移镜头", promptSuffix: "镜头平行横移，跟随主体运动" },
  { id: "zoom", name: "变焦", promptSuffix: "变焦推拉，景别快速变化" },
  { id: "crane-up", name: "升镜头", promptSuffix: "镜头从低处缓慢升高，展现全景" },
  { id: "crane-down", name: "降镜头", promptSuffix: "镜头从高处缓慢降低，聚焦主体" },
];
