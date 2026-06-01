import express from "express";
import { serve } from "inngest/express";
import { inngest } from "./inngest.js";
import { skillRunFunction } from "./functions/skill-run.js";

const app = express();
const port = Number(process.env.WORKFLOW_WORKER_PORT ?? 8288);

app.use(
  "/api/inngest",
  serve({
    client: inngest,
    functions: [skillRunFunction],
  }),
);

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "aimarket-workflow-worker" });
});

app.listen(port, () => {
  console.log(
    `AIMarket workflow-worker (Inngest) listening on http://localhost:${port}/api/inngest`,
  );
});
