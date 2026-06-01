import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "aimarket",
  eventKey: process.env.INNGEST_EVENT_KEY,
  baseUrl: process.env.INNGEST_BASE_URL,
});
