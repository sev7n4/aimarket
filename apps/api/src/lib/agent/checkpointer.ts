import { MemorySaver } from "@langchain/langgraph";
import type { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint";
import path from "node:path";

let checkpointer: BaseCheckpointSaver | null = null;
let initPromise: Promise<BaseCheckpointSaver> | null = null;

export function resolveAgentCheckpointerMode(): "memory" | "sqlite" {
  const mode = (process.env.AGENT_CHECKPOINTER ?? "memory").toLowerCase();
  return mode === "sqlite" ? "sqlite" : "memory";
}

export async function initAgentCheckpointer(): Promise<BaseCheckpointSaver> {
  if (checkpointer) return checkpointer;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const mode = resolveAgentCheckpointerMode();
    if (mode === "sqlite") {
      try {
        const { SqliteSaver } = await import(
          "@langchain/langgraph-checkpoint-sqlite"
        );
        const dbPath =
          process.env.AGENT_CHECKPOINT_SQLITE_PATH ??
          path.join(
            process.env.DATABASE_PATH
              ? path.dirname(process.env.DATABASE_PATH)
              : "./data",
            "agent-checkpoints.sqlite",
          );
        const saver = SqliteSaver.fromConnString(`sqlite://${dbPath}`);
        if (typeof (saver as { setup?: () => Promise<void> }).setup === "function") {
          await (saver as { setup: () => Promise<void> }).setup();
        }
        console.log(`[agent] checkpointer=sqlite path=${dbPath}`);
        checkpointer = saver;
        return saver;
      } catch (err) {
        console.warn(
          "[agent] SqliteSaver unavailable (build better-sqlite3?), fallback memory:",
          err,
        );
      }
    }

    checkpointer = new MemorySaver();
    console.log("[agent] checkpointer=memory");
    return checkpointer;
  })();

  return initPromise;
}

export function getAgentCheckpointer(): BaseCheckpointSaver {
  if (!checkpointer) {
    throw new Error("Agent checkpointer not initialized; call initAgentCheckpointer()");
  }
  return checkpointer;
}
