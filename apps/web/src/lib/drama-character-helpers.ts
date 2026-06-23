import type { DramaCharacterCard } from "@/lib/types";

export const CHARACTER_ANGLE_LABELS: Record<
  "front" | "three_quarter" | "side",
  string
> = {
  front: "正面",
  three_quarter: "3/4 侧面",
  side: "侧面",
};

export function characterTurnaroundRefsComplete(
  char: DramaCharacterCard,
): boolean {
  if (char.refUrl) return true;
  const ids = char.refOutputIds;
  return Boolean(ids?.front && ids?.three_quarter && ids?.side);
}

export function allCharactersLockedForProduce(
  characters: DramaCharacterCard[],
): boolean {
  return (
    characters.length > 0 &&
    characters.every(
      (c) =>
        c.turnaroundStatus === "locked" && characterTurnaroundRefsComplete(c),
    )
  );
}

export function characterRefImageUrl(
  char: DramaCharacterCard,
  angle: "front" | "three_quarter" | "side",
): string | undefined {
  if (char.refUrl) return char.refUrl;
  return char.refUrls?.[angle];
}
