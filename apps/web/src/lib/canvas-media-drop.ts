/** Default horizontal step between dropped media nodes (image width 340 + 20px). */
export const DEFAULT_MEDIA_DROP_GAP = 360;

const MEDIA_FILE_TYPE = /^(image|video)\//i;

export function filterMediaFiles(files: File[]): File[] {
  return files.filter((file) => MEDIA_FILE_TYPE.test(file.type));
}

export function mediaDropPositions(
  count: number,
  origin: { x: number; y: number },
  gap = DEFAULT_MEDIA_DROP_GAP,
): { x: number; y: number }[] {
  if (count <= 0) return [];
  return Array.from({ length: count }, (_, index) => ({
    x: origin.x + index * gap,
    y: origin.y,
  }));
}
