"use client";

import React, { useCallback, useRef, useState } from "react";
import { Bot, Loader2, PanelRightClose } from "lucide-react";

import { canvasTheme } from "../canvas-theme";
import { cn } from "@aimarket/ui";
import type { CanvasAgentSnapshot } from "../utils";
import type { OrchestratorMessage, OrchestratorToolCall } from "./types";
import {
  ALL_AGENT_TOOLS,
  describeSnapshotForAgent,
  onlineToolToOps,
} from "./agent-tools";
import type { ToolCallResult } from "./online-agent-loop";

type PanelTab = "chat" | "history" | "log";
type MessageRole = "user" | "assistant" | "tool" | "error";

interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  title?: string;
  toolCalls?: OrchestratorToolCall[];
  toolResults?: ToolCallResult[];
  pending?: boolean;
}

interface AgentLog {
  id: string;
  time: string;
  title: string;
  data?: unknown;
}

const MAX_AGENT_STEPS = 6;

type CanvasAssistantPanelProps = {
  snapshot: CanvasAgentSnapshot;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onApplyOps: (ops: any) => CanvasAgentSnapshot;
  initialCollapsed?: boolean;
  confirmTools?: boolean;
};

function nanoid() {
  return Math.random().toString(36).slice(2, 11);
}

export function CanvasAssistantPanel({
  snapshot,
  onApplyOps,
  initialCollapsed = false,
  confirmTools = false,
}: CanvasAssistantPanelProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [tab, setTab] = useState<PanelTab>("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [pendingToolCalls, setPendingToolCalls] = useState<{ toolCalls: OrchestratorToolCall[]; step: number } | null>(null);

  // Snapshot ref for agent loop (updated on each render)
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  // Message history for agent loop
  const historyMessagesRef = useRef<OrchestratorMessage[]>([]);

  const addLog = useCallback((title: string, data?: unknown) => {
    setLogs((prev) => [
      { id: nanoid(), time: new Date().toLocaleTimeString(), title, data },
      ...prev,
    ].slice(0, 80));
  }, []);

  const appendMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const upsertMessage = useCallback((id: string, patch: Partial<ChatMessage>) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    );
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isRunning) return;

    setInput("");
    setIsRunning(true);
    setTab("chat");

    // Build history for agent
    const historyForAgent: OrchestratorMessage[] = [
      ...historyMessagesRef.current,
      { role: "user", content: text },
    ];

    // Add user message
    appendMessage({ id: nanoid(), role: "user", text });

    addLog("发送请求", {
      text,
      selectedNodeIds: snapshotRef.current.selectedNodeIds,
      nodeCount: snapshotRef.current.nodes.length,
    });

    let step = 1;
    let isFirstStep = true;
    let pendingCalls: { toolCalls: OrchestratorToolCall[]; step: number } | null = null;

    const handleToolPending = (toolCalls: OrchestratorToolCall[], s: number) => {
      pendingCalls = { toolCalls, step: s };
      setPendingToolCalls({ toolCalls, step: s });
      upsertMessage(nanoid(), {
        id: nanoid(),
        role: "assistant",
        text: "准备执行操作，等待确认…",
        toolCalls,
        pending: true,
      });
    };

    const handleToolApproved = (results: ToolCallResult[], s: number) => {
      addLog(`步骤 ${s} 执行完成`, results);
      setPendingToolCalls(null);
      pendingCalls = null;

      // Add tool result message
      appendMessage({
        id: nanoid(),
        role: "tool",
        text: results.map((r) => `${r.name}: ${r.message}`).join("\n"),
        toolResults: results,
      });

      // Apply ops
      const allOps = results
        .filter((r) => r.ok && r.data?.ops)
        .flatMap((r) => (r.data?.ops as Parameters<typeof onlineToolToOps>[2] extends (...args: infer A) => unknown ? A[2] : never) ?? []);

      if (allOps.length > 0) {
        handleApplyOps(allOps as Parameters<typeof onApplyOps>[0]);
      }
    };

    const handleAssistantMessage = (text: string) => {
      upsertMessage(nanoid(), { id: nanoid(), role: "assistant", text });
    };

    const handleError = (error: string) => {
      addLog("Agent 错误", error);
      appendMessage({ id: nanoid(), role: "error", text: error });
    };

    const handleComplete = (finalText: string) => {
      addLog("Agent 完成", finalText);
      if (finalText) {
        appendMessage({ id: nanoid(), role: "assistant", text: finalText });
      }
      historyMessagesRef.current = [
        ...historyMessagesRef.current,
        { role: "user", content: text },
        ...(finalText ? [{ role: "assistant" as const, content: finalText }] : []),
      ];
      setIsRunning(false);
    };

    // Run the agent loop (simplified - handles auto-execute mode)
    // Note: confirm mode would require additional state management
    try {
      // First call - forced tool choice
      const res = await fetch("/api/v1/agent/tool-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: `你是 AIMarket 画布助手。当前画布：\n${describeSnapshotForAgent(snapshotRef.current)}`,
            },
            ...historyForAgent,
          ],
          tools: ALL_AGENT_TOOLS,
          toolChoice: "required",
          maxTokens: 4096,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        handleError(`Agent 请求失败 ${res.status}: ${err}`);
        setIsRunning(false);
        return;
      }

      const { data } = await res.json() as { data: { content: string; toolCalls: OrchestratorToolCall[] } };

      if (data.toolCalls?.length === 0) {
        handleAssistantMessage(data.content || "没有回复内容");
        handleComplete(data.content || "");
        return;
      }

      // Add assistant message
      appendMessage({ id: nanoid(), role: "assistant", text: data.content || "正在执行工具…" });

      // Build message list for next round
      const messagesForRound: OrchestratorMessage[] = [
        ...historyForAgent,
        { role: "assistant", content: data.content || "" },
      ];

      // Execute tools locally
      const results: ToolCallResult[] = data.toolCalls.map((tc) => {
        try {
          const args = typeof tc.arguments === "string" ? JSON.parse(tc.arguments) : tc.arguments;
          const ops = onlineToolToOps(tc.name, args as Record<string, unknown>, snapshotRef.current);
          if (ops.length === 0) {
            return { toolCallId: tc.id, name: tc.name, ok: true, message: "无画布变更" };
          }
          return {
            toolCallId: tc.id,
            name: tc.name,
            ok: true,
            message: ops.map((op) => `${op.type} 执行`).join("; "),
            data: { ops },
          };
        } catch (err) {
          return {
            toolCallId: tc.id,
            name: tc.name,
            ok: false,
            message: err instanceof Error ? err.message : "执行失败",
          };
        }
      });

      addLog("工具执行结果", results);
      appendMessage({
        id: nanoid(),
        role: "tool",
        text: results.map((r) => `${r.name}: ${r.message}`).join("\n"),
        toolResults: results,
      });

      // Apply ops
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allOps = results
        .filter((r) => r.ok && r.data?.ops)
        .flatMap((r) => (r.data?.ops as any[]) ?? []);
      if (allOps.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onApplyOps(allOps as any);
      }

      // Continue with tool results in messages
      const messagesWithResults: OrchestratorMessage[] = [
        ...messagesForRound,
        ...data.toolCalls.map((tc) => {
          const r = results.find((x) => x.toolCallId === tc.id);
          return {
            role: "tool" as const,
            content: JSON.stringify(r ?? { ok: false, message: "unknown" }),
          };
        }),
      ];

      // Second call - auto tool choice (up to MAX_AGENT_STEPS - 1 more rounds)
      for (let i = 1; i < MAX_AGENT_STEPS; i++) {
        const res2 = await fetch("/api/v1/agent/tool-response", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: messagesWithResults,
            tools: ALL_AGENT_TOOLS,
            toolChoice: "auto",
            maxTokens: 4096,
          }),
        });

        if (!res2.ok) {
          const err = await res2.text();
          handleError(`Agent 循环错误 ${res2.status}: ${err}`);
          setIsRunning(false);
          return;
        }

        const { data: data2 } = await res2.json() as { data: { content: string; toolCalls: OrchestratorToolCall[] } };

        if (data2.toolCalls?.length === 0) {
          handleAssistantMessage(data2.content || "操作完成");
          handleComplete(data2.content || "");
          return;
        }

        // Add assistant message
        appendMessage({ id: nanoid(), role: "assistant", text: data2.content || "正在执行…" });

        // Execute tools
        const results2: ToolCallResult[] = data2.toolCalls.map((tc) => {
          try {
            const args = typeof tc.arguments === "string" ? JSON.parse(tc.arguments) : tc.arguments;
            const ops = onlineToolToOps(tc.name, args as Record<string, unknown>, snapshotRef.current);
            if (ops.length === 0) {
              return { toolCallId: tc.id, name: tc.name, ok: true, message: "无画布变更" };
            }
            return {
              toolCallId: tc.id,
              name: tc.name,
              ok: true,
              message: ops.map((op) => `${op.type} 执行`).join("; "),
              data: { ops },
            };
          } catch (err) {
            return {
              toolCallId: tc.id,
              name: tc.name,
              ok: false,
              message: err instanceof Error ? err.message : "执行失败",
            };
          }
        });

        addLog(`步骤 ${i + 1} 执行`, results2);
        appendMessage({
          id: nanoid(),
          role: "tool",
          text: results2.map((r) => `${r.name}: ${r.message}`).join("\n"),
          toolResults: results2,
        });

        const allOps2 = results2
          .filter((r) => r.ok && r.data?.ops)
          .flatMap((r) => (r.data?.ops as any[]) ?? []);
        if (allOps2.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onApplyOps(allOps2 as any);
        }

        // Update messages with tool results
        messagesForRound.push({ role: "assistant", content: data2.content || "" });
        messagesForRound.push(
          ...data2.toolCalls.map((tc) => {
            const r = results2.find((x) => x.toolCallId === tc.id);
            return {
              role: "tool" as const,
              content: JSON.stringify(r ?? { ok: false, message: "unknown" }),
            };
          }),
        );
      }

      addLog("达到最大步数上限", { maxSteps: MAX_AGENT_STEPS });
      appendMessage({ id: nanoid(), role: "assistant", text: `已达到最大步数限制 (${MAX_AGENT_STEPS} 步)。` });
      setIsRunning(false);
    } catch (err) {
      handleError(err instanceof Error ? err.message : "未知错误");
      setIsRunning(false);
    }
  }, [input, isRunning, appendMessage, addLog, onApplyOps, upsertMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="absolute right-0 top-1/2 z-30 flex size-10 items-center justify-center rounded-l-lg transition hover:bg-white/10"
        style={{ background: canvasTheme.canvas.background, borderColor: canvasTheme.node.stroke }}
        aria-label="展开助手面板"
      >
        <Bot className="size-5" style={{ color: canvasTheme.node.muted }} />
      </button>
    );
  }

  return (
    <div
      className="absolute right-0 top-0 flex h-full w-[380px] flex-col border-l"
      style={{
        background: canvasTheme.canvas.background,
        borderColor: canvasTheme.node.stroke,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: canvasTheme.node.stroke }}
      >
        <div className="flex items-center gap-2">
          <Bot className="size-4" style={{ color: canvasTheme.node.muted }} />
          <span className="text-sm font-semibold" style={{ color: canvasTheme.node.text }}>
            画布助手
          </span>
          {isRunning && <Loader2 className="size-3.5 animate-spin" style={{ color: canvasTheme.node.muted }} />}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="rounded p-1 transition hover:bg-white/10"
            aria-label="收起面板"
          >
            <PanelRightClose className="size-4" style={{ color: canvasTheme.node.faint }} />
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div
        className="flex border-b"
        style={{ borderColor: canvasTheme.node.stroke }}
      >
        {(["chat", "history", "log"] as PanelTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 px-3 py-2 text-xs font-medium transition",
              tab === t
                ? "border-b-2"
                : "text-white/40 hover:text-white/60",
            )}
            style={{
              color: tab === t ? canvasTheme.node.text : undefined,
              borderColor: tab === t ? "#6366f1" : "transparent",
            }}
          >
            {t === "chat" ? "对话" : t === "history" ? "历史" : "日志"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "chat" && (
          <div className="flex flex-col gap-2 p-3">
            {messages.length === 0 && (
              <div
                className="rounded-lg p-4 text-center text-xs"
                style={{ color: canvasTheme.node.faint, background: canvasTheme.node.fill }}
              >
                <Bot className="mx-auto mb-2 size-6 opacity-50" />
                对画布下达指令，助手将自动执行
              </div>
            )}
            {messages.map((msg) => (
              <ChatMessageItem key={msg.id} message={msg} />
            ))}
          </div>
        )}

        {tab === "history" && (
          <div className="p-3 text-center text-xs" style={{ color: canvasTheme.node.faint }}>
            历史会话功能开发中
          </div>
        )}

        {tab === "log" && (
          <div className="flex flex-col gap-0.5 p-2">
            {logs.length === 0 && (
              <div className="p-3 text-center text-xs" style={{ color: canvasTheme.node.faint }}>
                暂无日志
              </div>
            )}
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-2 rounded px-2 py-1 text-[11px]"
                style={{ background: canvasTheme.node.fill }}
              >
                <span className="shrink-0" style={{ color: canvasTheme.node.faint }}>
                  {log.time}
                </span>
                <span style={{ color: canvasTheme.node.muted }}>{log.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tool confirmation */}
      {pendingToolCalls && (
        <div
          className="border-t p-3"
          style={{ borderColor: canvasTheme.node.stroke, background: canvasTheme.node.fill }}
        >
          <div className="mb-2 text-xs font-medium" style={{ color: canvasTheme.node.text }}>
            确认执行以下操作？
          </div>
          <div className="mb-2 flex flex-wrap gap-1">
            {pendingToolCalls.toolCalls.map((tc) => (
              <span
                key={tc.id}
                className="rounded-full px-2 py-0.5 text-[10px]"
                style={{ background: "#6366f122", color: "#818cf8" }}
              >
                {tc.name}
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-lg py-1.5 text-xs font-medium transition"
              style={{ background: "#6366f1", color: "#fff" }}
            >
              确认
            </button>
            <button
              type="button"
              className="flex-1 rounded-lg py-1.5 text-xs font-medium transition"
              style={{ background: canvasTheme.node.panel, color: canvasTheme.node.muted }}
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div
        className="flex items-end gap-2 border-t p-3"
        style={{ borderColor: canvasTheme.node.stroke }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="描述你想要的操作…"
          rows={2}
          className="min-h-[52px] max-h-[120px] flex-1 resize-none rounded-lg border px-3 py-2 text-xs outline-none transition placeholder:text-zinc-600 focus:border-indigo-500/50"
          style={{
            background: canvasTheme.node.fill,
            borderColor: canvasTheme.node.stroke,
            color: canvasTheme.node.text,
          }}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!input.trim() || isRunning}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg font-medium transition disabled:opacity-30"
          style={{
            background: input.trim() && !isRunning ? "#6366f1" : canvasTheme.node.fill,
            color: input.trim() && !isRunning ? "#fff" : canvasTheme.node.faint,
          }}
          aria-label="发送"
        >
          {isRunning ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Chat message item ──

function ChatMessageItem({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const isError = message.role === "error";

  return (
    <div
      className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start")}
    >
      <div
        className={cn("max-w-[85%] rounded-2xl px-3 py-2 text-xs", isUser ? "rounded-br-md" : "rounded-bl-md")}
        style={
          isError
            ? { background: "#ef444422", color: "#fca5a5" }
            : isUser
            ? { background: "#6366f1", color: "#fff" }
            : { background: canvasTheme.node.fill, color: canvasTheme.node.text }
        }
      >
        {message.title && (
          <div className="mb-0.5 text-[10px] font-semibold" style={{ opacity: 0.7 }}>
            {message.title}
          </div>
        )}
        <p className="whitespace-pre-wrap">{message.text}</p>
        {message.pending && (
          <Loader2 className="mt-1 size-3 animate-spin" />
        )}
      </div>
      {message.toolResults && message.toolResults.length > 0 && (
        <div
          className="max-w-[85%] rounded-xl px-3 py-2 text-[10px]"
          style={{ background: canvasTheme.node.panel, color: canvasTheme.node.muted }}
        >
          {message.toolResults.map((r, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span
                className="mt-0.5 size-1.5 shrink-0 rounded-full"
                style={{ background: r.ok ? "#22c55e" : "#ef4444" }}
              />
              <span>
                <span style={{ color: canvasTheme.node.text }}>{r.name}</span>: {r.message}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
