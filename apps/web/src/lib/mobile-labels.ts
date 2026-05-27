/** 对外统一术语（P2-1） */
export const LABELS = {
  studioPage: "创作页",
  chatPanel: "对话区",
  chatPanelShort: "对话",
  canvas: "画布",
  workspace: "工作区",
  openChatPanel: "打开对话区",
  closeChatPanel: "收起对话区",
} as const;

export function canvasEmptyHintMobile(): string {
  return "生成结果将显示在上方画布";
}

export function chatEmptyHint(isMobile: boolean): string {
  return isMobile
    ? "点右下角「对话区」描述需求，结果会出现在上方画布"
    : "在右侧描述需求，结果会出现在左侧画布";
}

export function canvasSelectionHint(isMobile: boolean, selected: boolean): string {
  if (!selected) return "";
  return isMobile ? " · 可拖拽 · 工具栏删除" : " · 可拖拽 · Del 删除";
}
