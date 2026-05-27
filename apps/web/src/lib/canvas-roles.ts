import type { CanvasItem, CanvasItemRole } from "@/lib/canvas-tools";

export const CANVAS_ROLE_LABELS: Record<CanvasItemRole, string> = {
  reference: "套图参考",
  product: "商品素材",
  output: "成品",
};

export function findCanvasItemByRole(
  items: CanvasItem[],
  role: CanvasItemRole,
): CanvasItem | undefined {
  return items.find((item) => item.role === role && item.assetId);
}

export function assignCanvasItemRole(
  items: CanvasItem[],
  itemId: string,
  role: CanvasItemRole,
): CanvasItem[] {
  return items.map((item) => {
    if (item.id === itemId) {
      return { ...item, role, label: CANVAS_ROLE_LABELS[role] };
    }
    if (item.role === role && role !== "output") {
      const { role: _removed, ...rest } = item;
      return {
        ...rest,
        label: item.source === "generation" ? item.label : "上传",
      };
    }
    return item;
  });
}
