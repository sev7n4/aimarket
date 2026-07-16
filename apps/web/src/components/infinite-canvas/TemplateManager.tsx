"use client";

/** Drama 模板管理器已随 Phase C 下线 */
export function TemplateManager(_props: {
  sessionId?: string;
  selectedNodes?: unknown[];
  selectedConnections?: unknown[];
  onClose?: () => void;
  onPlanRunStarted?: (planRunId: string, template: Record<string, unknown>) => void;
}) {
  return null;
}
