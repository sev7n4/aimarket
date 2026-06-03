const CIRCLED = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];

export function focusIndexLabel(index: number): string {
  return CIRCLED[index] ?? `${index + 1}`;
}
