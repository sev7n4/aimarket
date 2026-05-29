/** Studio AI 工具默认输出分辨率（火山 Seedream 等需较大 size） */
export function resolveToolResolution(
  toolId: string,
): "1k" | "2k" | "4k" {
  switch (toolId) {
    case "cutout":
    case "expand":
    case "inpaint":
    case "focus-edit":
      return "4k";
    case "upscale":
    case "enhance":
      return "2k";
    default:
      return "2k";
  }
}

const ASPECT_RATIOS: [number, number, string][] = [
  [1, 1, "1:1"],
  [4, 3, "4:3"],
  [3, 4, "3:4"],
  [16, 9, "16:9"],
  [9, 16, "9:16"],
  [3, 2, "3:2"],
  [2, 3, "2:3"],
  [4, 5, "4:5"],
  [5, 4, "5:4"],
  [21, 9, "21:9"],
];

export function inferAspectRatio(
  width: number,
  height: number,
): string {
  if (!width || !height) return "1:1";
  const actual = width / height;
  let best = ASPECT_RATIOS[0];
  let minDiff = Infinity;
  for (const [w, h, label] of ASPECT_RATIOS) {
    const diff = Math.abs(actual - w / h);
    if (diff < minDiff) {
      minDiff = diff;
      best = [w, h, label];
    }
  }
  return best[2];
}
