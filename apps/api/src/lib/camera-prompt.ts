/** 摄像机参数，由前端 CameraState 序列化传入 */
export interface CameraParams {
  /** 俯仰角 -45 到 45 度 */
  tilt: number;
  /** 水平角 -90 到 90 度 */
  pan: number;
  /** 景别/焦距 */
  fov: "close-up" | "close-shot" | "medium" | "full" | "wide";
}

/** 俯仰角 → 中文运镜描述 */
function encodeTilt(tilt: number): string {
  if (tilt < -20) return "低角度仰拍";
  if (tilt < -5) return "轻微仰拍";
  if (tilt <= 5) return "平拍";
  if (tilt <= 20) return "轻微俯拍";
  return "高角度俯拍";
}

/** 水平角 → 中文运镜描述 */
function encodePan(pan: number): string {
  if (pan < -45) return "左侧拍摄";
  if (pan < -10) return "略偏左";
  if (pan <= 10) return "正面拍摄";
  if (pan <= 45) return "略偏右";
  return "右侧拍摄";
}

/** 景别 → 中文运镜描述 */
function encodeFov(fov: CameraParams["fov"]): string {
  const map: Record<CameraParams["fov"], string> = {
    "close-up": "特写",
    "close-shot": "近景",
    medium: "中景",
    full: "全景",
    wide: "广角远景",
  };
  return map[fov];
}

/**
 * 将摄像机参数编码为中文运镜描述词，附加到视频生成 prompt。
 * 格式："{tilt映射}，{pan映射}，{fov映射}"
 */
export function encodeCameraPrompt(camera: CameraParams): string {
  return `${encodeTilt(camera.tilt)}，${encodePan(camera.pan)}，${encodeFov(camera.fov)}`;
}
