import { MemorySaver } from "@langchain/langgraph";
import path from "node:path";

/** 与 agent-core `createSessionGraph` 注入类型一致，避免 checkpoint 包双版本冲突 */
export type AgentCheckpointer = unknown;

let checkpointer: AgentCheckpointer | null = null;
let initPromise: Promise<AgentCheckpointer> | null = null;

export function resolveAgentCheckpointerMode(): "memory" | "sqlite" {
  const mode = (process.env.AGENT_CHECKPOINTER ?? "memory").toLowerCase();
  return mode === "sqlite" ? "sqlite" : "memory";
}

export async function initAgentCheckpointer(): Promise<AgentCheckpointer> {
  if (checkpointer) return checkpointer;
  if (initPromise) return initPromise;

  initPromise = (async (): Promise<AgentCheckpointer> => {
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
        const withSetup = saver as unknown as {
          setup?: () => Promise<void>;
        };
        if (typeof withSetup.setup === "function") {
          await withSetup.setup();
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

    const memory = new MemorySaver();
    checkpointer = memory;
    console.log("[agent] checkpointer=memory");
    return memory;
  })();

  return initPromise;
}

export function getAgentCheckpointer(): AgentCheckpointer {
  if (!checkpointer) {
    throw new Error("Agent checkpointer not initialized; call initAgentCheckpointer()");
  }
  return checkpointer;
}
