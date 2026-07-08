/**
 * NeoWOW 式 Workflow Shell（/workflow）
 * 左：无限画布 · 右：Agent 对话（默认可拖拽调宽）
 */

export const WORKFLOW_AGENT_PANEL = {
  storageKey: "aimarket_workflow_agent_panel_width",
  defaultWidth: 520,
  minWidth: 480,
  maxWidth: 900,
} as const;

export type WorkflowShellConfig = {
  enabled: boolean;
};

export function createWorkflowShellConfig(enabled = true): WorkflowShellConfig {
  return { enabled };
}

export function isWorkflowShellEnabled(
  config?: WorkflowShellConfig | boolean,
): boolean {
  if (typeof config === "boolean") return config;
  return config?.enabled === true;
}
