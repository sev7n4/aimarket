/** 灯光控制 prompt 编码（与前端 LightSource 类型对齐的本地副本） */

export interface LightSource {
  id: string;
  /** 归一化 X 坐标 0-1 */
  x: number;
  /** 归一化 Y 坐标 0-1 */
  y: number;
  /** 色温 */
  colorTemp: "warm-white" | "cool-white" | "warm-yellow";
  /** 强度 0-1 */
  intensity: number;
  /** 光源类型 */
  lightType: "point" | "area" | "spot";
}

/* ── 映射辅助 ── */

/** X 坐标 → 水平方位 */
function mapX(x: number): string {
  if (x < 0.33) return "左侧";
  if (x > 0.67) return "右侧";
  return "中部";
}

/** Y 坐标 → 垂直方位 */
function mapY(y: number): string {
  if (y < 0.33) return "顶部";
  if (y > 0.67) return "底部";
  return "中间";
}

/** 色温映射 */
const COLOR_TEMP_MAP: Record<LightSource["colorTemp"], string> = {
  "warm-white": "暖白光",
  "cool-white": "冷白光",
  "warm-yellow": "暖黄光",
};

/** 光源类型映射 */
const LIGHT_TYPE_MAP: Record<LightSource["lightType"], string> = {
  point: "点光源",
  area: "面光源",
  spot: "聚光灯",
};

/** 强度映射 */
function mapIntensity(intensity: number): string {
  if (intensity > 0.8) return "强烈";
  if (intensity >= 0.5) return "柔和";
  return "微弱";
}

/**
 * 将光源数组编码为中文 prompt 片段
 *
 * 格式："{位置}{色温}{类型}，{强度}照射"
 * 多光源用顿号分隔
 *
 * 示例："左侧暖黄聚光灯，强烈照射、右侧冷白面光源，柔和照射"
 */
export function encodeLightingPrompt(lights: LightSource[]): string {
  if (!lights.length) return "";

  return lights
    .map((l) => {
      const position = `${mapX(l.x)}${mapY(l.y)}`;
      const colorTemp = COLOR_TEMP_MAP[l.colorTemp];
      const lightType = LIGHT_TYPE_MAP[l.lightType];
      const intensity = mapIntensity(l.intensity);
      return `${position}${colorTemp}${lightType}，${intensity}照射`;
    })
    .join("、");
}
