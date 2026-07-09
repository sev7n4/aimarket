import { request } from "./core";
import type { WorkflowTemplatePayload } from "@/lib/workflow-template-apply";

export type WorkflowTemplateItem = {
  id: string;
  name: string;
  description?: string;
  template: WorkflowTemplatePayload;
  isPreset: boolean;
  createdAt: string;
  updatedAt: string;
};

export async function listWorkflowTemplates() {
  const res = await request<{ data: WorkflowTemplateItem[] }>(
    "/api/v1/workflow-templates",
  );
  return res.data;
}

export async function saveWorkflowTemplate(body: {
  name: string;
  description?: string;
  template: WorkflowTemplatePayload;
}) {
  const res = await request<{ data: WorkflowTemplateItem }>(
    "/api/v1/workflow-templates",
    { method: "POST", body: JSON.stringify(body) },
  );
  return res.data;
}

export async function deleteWorkflowTemplate(id: string) {
  await request(`/api/v1/workflow-templates/${id}`, { method: "DELETE" });
}

export async function getWorkflowTemplate(id: string) {
  const res = await request<{ data: WorkflowTemplateItem }>(
    `/api/v1/workflow-templates/${id}`,
  );
  return res.data;
}
