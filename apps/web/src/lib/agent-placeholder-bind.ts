import type { CanvasItem } from "@/lib/canvas-tools";

/** Agent 在无限画布上预置的占位节点（尚无 output/url） */
export function isAgentPlaceholderItem(item: CanvasItem): boolean {
  if (item.infiniteNodeType) return false;
  if (item.outputId) return false;
  if (item.url?.trim()) return false;
  return true;
}

/**
 * 将 Job 产出合并回 Agent 占位节点，避免同位置重复出现新节点。
 * 依赖 applyPendingBatchLineage 已写入 sourceItemId。
 */
export function bindAgentPlaceholderOutputs(items: CanvasItem[]): CanvasItem[] {
  const placeholderIds = new Set(
    items.filter(isAgentPlaceholderItem).map((item) => item.id),
  );
  if (placeholderIds.size === 0) return items;

  const consumedOutputIds = new Set<string>();
  const bound = items.map((item) => {
    if (!placeholderIds.has(item.id)) return item;

    const output = items.find(
      (candidate) =>
        Boolean(candidate.url?.trim()) &&
        candidate.sourceItemId === item.id &&
        !consumedOutputIds.has(candidate.id),
    );
    if (!output) return item;

    consumedOutputIds.add(output.id);
    return {
      ...item,
      url: output.url,
      thumbUrl: output.thumbUrl ?? item.thumbUrl,
      outputId: output.outputId,
      batchId: output.batchId,
      batchIndex: output.batchIndex,
      batchTitle: output.batchTitle ?? item.batchTitle,
      batchSubtitle: output.batchSubtitle ?? item.batchSubtitle,
      parentBatchId: output.parentBatchId ?? item.parentBatchId,
      source: output.source ?? item.source ?? "generation",
      role: output.role ?? item.role,
      isVideo: output.isVideo,
      generationParams: output.generationParams ?? item.generationParams,
      sourceItemId: undefined,
      infiniteNodeMeta: {
        ...item.infiniteNodeMeta,
        status: "success" as const,
        prompt: item.infiniteNodeMeta?.prompt ?? output.generationParams?.prompt,
      },
    };
  });

  if (consumedOutputIds.size === 0) return items;
  return bound.filter((item) => !consumedOutputIds.has(item.id));
}
