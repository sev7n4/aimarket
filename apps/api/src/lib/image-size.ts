const BASE: Record<string, number> = { "1k": 1024, "2k": 1536, "4k": 2048 };

export function resolveImageDimensions(
  resolution: string,
  aspectRatio = "1:1",
): [number, number] {
  const base = BASE[resolution.toLowerCase()] ?? 1024;
  if (aspectRatio === "auto") {
    return [base, base];
  }
  switch (aspectRatio) {
    case "16:9":
      return [Math.round(base * 1.33), base];
    case "9:16":
      return [base, Math.round(base * 1.33)];
    case "21:9":
      return [Math.round(base * 1.78), base];
    case "4:3":
      return [Math.round(base * 1.15), base];
    case "3:4":
      return [base, Math.round(base * 1.15)];
    case "3:2":
      return [Math.round(base * 1.22), base];
    case "2:3":
      return [base, Math.round(base * 1.22)];
    case "5:4":
      return [Math.round(base * 1.12), base];
    case "4:5":
      return [base, Math.round(base * 1.12)];
    default:
      return [base, base];
  }
}
