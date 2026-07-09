import { Hono } from "hono";
import type { AuthVariables } from "../middleware/auth.js";
import {
  createWorkflowTemplate,
  deleteWorkflowTemplate,
  getWorkflowTemplate,
  listWorkflowTemplates,
  workflowTemplatePayloadSchema,
} from "../lib/workflow-template-service.js";
import { z } from "zod";

const workflowTemplates = new Hono<{ Variables: AuthVariables }>();

const createBody = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  template: workflowTemplatePayloadSchema,
});

workflowTemplates.get("/", (c) => {
  const userId = c.get("userId");
  return c.json({ data: listWorkflowTemplates(userId) });
});

workflowTemplates.post("/", async (c) => {
  const userId = c.get("userId");
  const body = createBody.parse(await c.req.json());
  const data = createWorkflowTemplate(userId, body);
  return c.json({ data }, 201);
});

workflowTemplates.get("/:id", (c) => {
  const userId = c.get("userId");
  const data = getWorkflowTemplate(userId, c.req.param("id"));
  return c.json({ data });
});

workflowTemplates.delete("/:id", (c) => {
  const userId = c.get("userId");
  const data = deleteWorkflowTemplate(userId, c.req.param("id"));
  return c.json({ data });
});

export { workflowTemplates };
