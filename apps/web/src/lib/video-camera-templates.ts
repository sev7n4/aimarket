/** 首尾帧 / 运镜快捷模板（对标即梦运镜 template，写入 motion prompt） */
export type VideoCameraTemplate = {
  id: string;
  label: string;
  prompt: string;
};

export const VIDEO_CAMERA_TEMPLATES: VideoCameraTemplate[] = [
  { id: "push-in", label: "推镜", prompt: "镜头缓慢推近主体，保持稳定" },
  { id: "pull-out", label: "拉镜", prompt: "镜头缓慢拉远，展现环境全貌" },
  { id: "pan-left", label: "左摇", prompt: "镜头从左向右平稳横移" },
  { id: "orbit", label: "环绕", prompt: "360度环绕运镜，主体居中" },
  { id: "tilt-up", label: "上摇", prompt: "镜头由下向上仰拍，强调纵深感" },
  { id: "handheld", label: "手持", prompt: "轻微手持晃动感，纪实风格" },
];
