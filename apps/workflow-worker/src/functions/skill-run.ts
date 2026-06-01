import { inngest } from "../inngest.js";

export const skillRunFunction = inngest.createFunction(
  {
    id: "skill-run-execute",
    name: "执行长 Skill 流水线",
    retries: 2,
  },
  { event: "aimarket/skill.run.requested" },
  async ({ event }) => {
    const { skillRunId, userId } = event.data as {
      skillRunId: string;
      userId: string;
    };
    const apiUrl = process.env.API_URL ?? "http://localhost:4000";
    const secret = process.env.INTERNAL_API_SECRET;
    if (!secret) {
      throw new Error("INTERNAL_API_SECRET is required");
    }

    const res = await fetch(
      `${apiUrl}/api/v1/internal/agent/skill-runs/${encodeURIComponent(skillRunId)}/execute`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Secret": secret,
        },
        body: JSON.stringify({ userId }),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`skill execute failed: ${res.status} ${text.slice(0, 200)}`);
    }

    return res.json();
  },
);
