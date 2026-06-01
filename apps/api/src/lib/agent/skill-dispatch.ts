import { Inngest } from "inngest";
import { executeSkillRun } from "./skill-executor.js";

export const inngestClient = new Inngest({
  id: "aimarket",
  eventKey: process.env.INNGEST_EVENT_KEY,
  baseUrl: process.env.INNGEST_BASE_URL,
});

export function isInngestSkillEnabled(): boolean {
  return Boolean(process.env.INNGEST_EVENT_KEY && process.env.INNGEST_BASE_URL);
}

export function dispatchSkillRun(skillRunId: string, userId: string) {
  if (isInngestSkillEnabled()) {
    void inngestClient
      .send({
        name: "aimarket/skill.run.requested",
        data: { skillRunId, userId },
      })
      .catch((err) => {
        console.warn("[skill] inngest send failed, fallback inline:", err);
        void executeSkillRun(skillRunId, userId).catch((e) => {
          console.error("[skill] inline execute failed:", e);
        });
      });
    return;
  }

  void executeSkillRun(skillRunId, userId).catch((err) => {
    console.error("[skill] inline execute failed:", err);
  });
}
