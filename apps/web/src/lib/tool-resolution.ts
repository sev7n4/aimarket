/** Studio AI 工具默认输出分辨率（火山 Seedream 等需较大 size） */
export function resolveToolResolution(
  toolId: string,
): "1k" | "2k" | "4k" {
  switch (toolId) {
    case "cutout":
    case "expand":
    case "inpaint":
      return "4k";
    case "upscale":
    case "enhance":
      return "2k";
    default:
      return "2k";
  }
}
