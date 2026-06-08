/**
 * @ 引用与 prompt 文本同步：解析 @label、移除 token、按 label 过滤状态。
 */

/** 从 prompt 提取不重复的 @ 引用 label（不含 @ 与后续空格） */
export function extractMentionLabelsFromPrompt(prompt: string): string[] {
  const labels: string[] = [];
  const re = /@([^\s@\n]+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(prompt)) !== null) {
    const label = match[1]?.trim();
    if (label && !labels.includes(label)) {
      labels.push(label);
    }
  }
  return labels;
}

/** 从 prompt 移除指定 @label token（含其后可选空白） */
export function removeMentionTokenFromPrompt(
  prompt: string,
  label: string,
): string {
  if (!label) return prompt;
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return prompt
    .replace(new RegExp(`@${escaped}\\s*`, "g"), "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/^[ \t]+|[ \t]+$/g, "");
}

/** 仅保留 prompt 中仍存在的 @ 引用（按 label 匹配） */
export function filterRefsByPromptLabels<T extends { label: string }>(
  refs: T[],
  labelsInPrompt: string[],
): T[] {
  return refs.filter((ref) => labelsInPrompt.includes(ref.label));
}

/** 按 label 映射过滤 assetId 列表 */
export function filterAssetIdsByPromptLabels(
  assetIds: string[],
  labelByAssetId: Map<string, string>,
  labelsInPrompt: string[],
): string[] {
  return assetIds.filter((id) => {
    const label = labelByAssetId.get(id);
    return label != null && labelsInPrompt.includes(label);
  });
}
