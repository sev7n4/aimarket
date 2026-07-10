"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Loader2, PanelRightClose } from "lucide-react";

import { canvasTheme } from "../canvas-theme";
import { cn } from "@aimarket/ui";
import type { CanvasAgentOp, CanvasAgentSnapshot } from "../utils";
import {
  runCanvasAgentLoop,
  continueAgentLoopAfterApproval,
  type ToolCallResult,
} from "./online-agent-loop";
import type { OrchestratorMessage, OrchestratorToolCall } from "./types";
import { getAgentToolsForContext } from "./agent-tools";
import {
  appendWorkflowAgentMessage,
  createWorkflowAgentConversation,
  listWorkflowAgentConversations,
  listWorkflowAgentMessages,
  type WorkflowAgentConversation,
} from "@/lib/api/workflow-agent";

const WORKFLOW_QUICK_TAGS = [
  "帮我加一个文生图节点",
  "添加文生图节点并生成产品主图",
  "连接选中节点并整理画布",
  "列出可用的工作流工具",
] as const;

type PanelTab = "chat" | "history" | "log";
type MessageRole = "user" | "assistant" | "tool" | "error";
type PanelVariant = "floating" | "docked";

interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  title?: string;
  toolCalls?: OrchestratorToolCall[];
  toolResults?: ToolCallResult[];
  pending?: boolean;
  streaming?: boolean;
}

interface AgentLog {
  id: string;
  time: string;
  title: string;
  data?: unknown;
}

type CanvasAssistantPanelProps = {
  snapshot: CanvasAgentSnapshot;
  onApplyOps: (ops: CanvasAgentOp[]) => CanvasAgentSnapshot;
  initialCollapsed?: boolean;
  confirmTools?: boolean;
  variant?: PanelVariant;
  width?: number;
  workflowShell?: boolean;
  sessionId?: string;
};

function nanoid() {
  return Math.random().toString(36).slice(2, 11);
}

function buildAgentCallbacks({
  appendMessage,
  updateMessage,
  addLog,
  setPendingToolCalls,
  onCompleteExtra,
  streamResponses = false,
  clearStreamingFlag,
}: {
  appendMessage: (msg: ChatMessage) => void;
  updateMessage: (id: string, updater: (msg: ChatMessage) => ChatMessage) => void;
  clearStreamingFlag: () => void;
  addLog: (title: string, data?: unknown) => void;
  setPendingToolCalls: React.Dispatch<
    React.SetStateAction<{
      toolCalls: OrchestratorToolCall[];
      step: number;
      messages: OrchestratorMessage[];
    } | null>
  >;
  onCompleteExtra?: (finalText: string) => void;
  streamResponses?: boolean;
}) {
  return {
    onAssistantStreamStart: streamResponses
      ? () => {
          const id = nanoid();
          appendMessage({ id, role: "assistant", text: "", streaming: true });
          return id;
        }
      : undefined,
    onAssistantDelta: streamResponses
      ? (messageId: string, delta: string) => {
          updateMessage(messageId, (msg) => ({
            ...msg,
            text: msg.text + delta,
          }));
        }
      : undefined,
    onAssistantMessage: (assistantText: string) => {
      appendMessage({ id: nanoid(), role: "assistant", text: assistantText });
    },
    onToolCallPending: (
      toolCalls: OrchestratorToolCall[],
      step: number,
      messages: OrchestratorMessage[],
    ) => {
      setPendingToolCalls({ toolCalls, step, messages });
      appendMessage({
        id: nanoid(),
        role: "assistant",
        text: "准备执行操作，等待确认…",
        toolCalls,
        pending: true,
      });
    },
    onToolCallApproved: (results: ToolCallResult[], step: number) => {
      addLog(`步骤 ${step} 执行完成`, results);
      setPendingToolCalls(null);
      appendMessage({
        id: nanoid(),
        role: "tool",
        text: results.map((r) => `${r.name}: ${r.message}`).join("\n"),
        toolResults: results,
      });
    },
    onToolCallRejected: (step: number) => {
      addLog(`步骤 ${step} 已取消`, null);
      setPendingToolCalls(null);
    },
    onMaxStepsReached: () => {
      addLog("达到最大步数上限", { maxSteps: 6 });
      appendMessage({
        id: nanoid(),
        role: "assistant",
        text: "已达到最大步数限制 (6 步)。",
      });
    },
    onError: (error: string) => {
      addLog("Agent 错误", error);
      appendMessage({ id: nanoid(), role: "error", text: error });
    },
    onComplete: (finalText: string) => {
      addLog("Agent 完成", finalText);
      if (finalText && !streamResponses) {
        appendMessage({ id: nanoid(), role: "assistant", text: finalText });
      }
      if (streamResponses) {
        clearStreamingFlag();
      }
      onCompleteExtra?.(finalText);
    },
  };
}

export function CanvasAssistantPanel({
  snapshot,
  onApplyOps,
  initialCollapsed = false,
  confirmTools = false,
  variant = "floating",
  width = 520,
  workflowShell = false,
  sessionId,
}: CanvasAssistantPanelProps) {
  const isDocked = variant === "docked";
  const agentTools = React.useMemo(
    () => getAgentToolsForContext({ workflowShell }),
    [workflowShell],
  );
  const [conversations, setConversations] = useState<WorkflowAgentConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [tab, setTab] = useState<PanelTab>("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [pendingToolCalls, setPendingToolCalls] = useState<{
    toolCalls: OrchestratorToolCall[];
    step: number;
    messages: OrchestratorMessage[];
  } | null>(null);

  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  const historyMessagesRef = useRef<OrchestratorMessage[]>([]);
  const conversationIdRef = useRef<string | null>(null);

  const ensureConversation = useCallback(async () => {
    if (!workflowShell || !sessionId) return null;
    if (conversationIdRef.current) return conversationIdRef.current;
    const conv = await createWorkflowAgentConversation({ sessionId });
    conversationIdRef.current = conv.id;
    setActiveConversationId(conv.id);
    setConversations((prev) => [conv, ...prev]);
    return conv.id;
  }, [workflowShell, sessionId]);

  const loadConversations = useCallback(async () => {
    if (!workflowShell || !sessionId) return;
    setHistoryLoading(true);
    try {
      const list = await listWorkflowAgentConversations(sessionId);
      setConversations(list);
      if (!conversationIdRef.current && list[0]) {
        conversationIdRef.current = list[0].id;
        setActiveConversationId(list[0].id);
      }
    } finally {
      setHistoryLoading(false);
    }
  }, [workflowShell, sessionId]);

  useEffect(() => {
    if (tab === "history") void loadConversations();
  }, [tab, loadConversations]);

  const loadConversationMessages = useCallback(async (conversationId: string) => {
    const rows = await listWorkflowAgentMessages(conversationId);
    setMessages(
      rows.map((row) => ({
        id: row.id,
        role: row.role === "user" ? "user" : row.role === "assistant" ? "assistant" : "tool",
        text: row.content,
      })),
    );
    historyMessagesRef.current = rows
      .filter((row) => row.role === "user" || row.role === "assistant")
      .map((row) => ({
        role: row.role as "user" | "assistant",
        content: row.content,
      }));
    conversationIdRef.current = conversationId;
    setActiveConversationId(conversationId);
    setTab("chat");
  }, []);

  const addLog = useCallback((title: string, data?: unknown) => {
    setLogs((prev) =>
      [{ id: nanoid(), time: new Date().toLocaleTimeString(), title, data }, ...prev].slice(
        0,
        80,
      ),
    );
  }, []);

  const appendMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const updateMessage = useCallback(
    (id: string, updater: (msg: ChatMessage) => ChatMessage) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? updater(m) : m)),
      );
    },
    [],
  );

  const clearStreamingFlag = useCallback(() => {
    setMessages((prev) =>
      prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)),
    );
  }, []);

  const runAgent = useCallback(
    async (text: string) => {
      if (!text || isRunning) return;

      setIsRunning(true);
      setTab("chat");
      appendMessage({ id: nanoid(), role: "user", text });

      addLog("发送请求", {
        text,
        selectedNodeIds: snapshotRef.current.selectedNodeIds,
        nodeCount: snapshotRef.current.nodes.length,
      });

      const userTurn: OrchestratorMessage = { role: "user", content: text };

      try {
        const convId = await ensureConversation();
        if (convId) {
          await appendWorkflowAgentMessage(convId, { role: "user", content: text });
        }

        await runCanvasAgentLoop({
          snapshot: snapshotRef.current,
          userMessage: text,
          historyMessages: historyMessagesRef.current,
          tools: agentTools,
          onApplyOps: (ops) => {
            const updated = onApplyOps(ops);
            snapshotRef.current = updated;
            return updated;
          },
          confirmTools,
          streamResponses: workflowShell,
          callbacks: buildAgentCallbacks({
            appendMessage,
            updateMessage,
            clearStreamingFlag,
            addLog,
            setPendingToolCalls,
            streamResponses: workflowShell,
            onCompleteExtra: async (finalText) => {
              historyMessagesRef.current = [
                ...historyMessagesRef.current,
                userTurn,
                ...(finalText ? [{ role: "assistant" as const, content: finalText }] : []),
              ];
              if (convId && finalText) {
                await appendWorkflowAgentMessage(convId, {
                  role: "assistant",
                  content: finalText,
                });
              }
            },
          }),
        });
      } catch (err) {
        addLog("Agent 异常", err);
        appendMessage({
          id: nanoid(),
          role: "error",
          text: err instanceof Error ? err.message : "未知错误",
        });
      } finally {
        setIsRunning(false);
      }
    },
    [isRunning, appendMessage, updateMessage, clearStreamingFlag, addLog, onApplyOps, confirmTools, ensureConversation, workflowShell, agentTools],
  );

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    await runAgent(text);
  }, [input, runAgent]);

  const handleApprovePending = useCallback(async () => {
    if (!pendingToolCalls || isRunning) return;
    setIsRunning(true);
    try {
      await continueAgentLoopAfterApproval({
        approvedToolCalls: pendingToolCalls.toolCalls,
        snapshot: snapshotRef.current,
        messages: pendingToolCalls.messages,
        tools: agentTools,
        step: pendingToolCalls.step,
        onApplyOps: (ops) => {
          const updated = onApplyOps(ops);
          snapshotRef.current = updated;
          return updated;
        },
        callbacks: buildAgentCallbacks({
          appendMessage,
          updateMessage,
          clearStreamingFlag,
          addLog,
          setPendingToolCalls,
          streamResponses: workflowShell,
        }),
        streamResponses: workflowShell,
      });
    } finally {
      setIsRunning(false);
    }
  }, [pendingToolCalls, isRunning, appendMessage, updateMessage, clearStreamingFlag, addLog, onApplyOps, workflowShell, agentTools]);

  const handleRejectPending = useCallback(() => {
    if (!pendingToolCalls) return;
    addLog(`步骤 ${pendingToolCalls.step} 已取消`, null);
    setPendingToolCalls(null);
  }, [pendingToolCalls, addLog]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend],
  );

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className={cn(
          "z-30 flex size-10 items-center justify-center rounded-l-lg transition hover:bg-white/10",
          isDocked ? "shrink-0" : "absolute right-0 top-1/2",
        )}
        style={{ background: canvasTheme.canvas.background, borderColor: canvasTheme.node.stroke }}
        aria-label="展开助手面板"
        data-testid="workflow-agent-expand"
      >
        <Bot className="size-5" style={{ color: canvasTheme.node.muted }} />
      </button>
    );
  }

  return (
    <div
      className={cn(
        "flex h-full flex-col border-l",
        isDocked ? "relative shrink-0" : "absolute right-0 top-0 w-[380px]",
      )}
      style={{
        width: isDocked ? width : undefined,
        background: isDocked ? "#1a1a1e" : canvasTheme.canvas.background,
        borderColor: canvasTheme.node.stroke,
      }}
      data-testid="workflow-agent-panel"
    >
      <div
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: canvasTheme.node.stroke }}
      >
        <div className="flex items-center gap-2">
          <Bot className="size-4" style={{ color: canvasTheme.node.muted }} />
          <span className="text-sm font-semibold" style={{ color: canvasTheme.node.text }}>
            {isDocked ? "Agent" : "画布助手"}
          </span>
          {isRunning && (
            <Loader2 className="size-3.5 animate-spin" style={{ color: canvasTheme.node.muted }} />
          )}
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="rounded p-1 transition hover:bg-white/10"
          aria-label="收起面板"
        >
          <PanelRightClose className="size-4" style={{ color: canvasTheme.node.faint }} />
        </button>
      </div>

      <div className="flex border-b" style={{ borderColor: canvasTheme.node.stroke }}>
        {(["chat", "history", "log"] as PanelTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 px-3 py-2 text-xs font-medium transition",
              tab === t ? "border-b-2" : "text-white/40 hover:text-white/60",
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
                {isDocked ? (
                  <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                    {WORKFLOW_QUICK_TAGS.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => void runAgent(tag)}
                        disabled={isRunning}
                        className="rounded-full border px-2.5 py-1 text-[10px] transition hover:bg-white/5 disabled:opacity-40"
                        style={{ borderColor: canvasTheme.node.stroke, color: canvasTheme.node.muted }}
                        data-testid="workflow-agent-quick-tag"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
            {messages.map((msg) => (
              <ChatMessageItem key={msg.id} message={msg} />
            ))}
          </div>
        )}

        {tab === "history" && (
          <div className="flex flex-col gap-2 p-3">
            {historyLoading ? (
              <p className="text-center text-xs" style={{ color: canvasTheme.node.faint }}>
                加载中…
              </p>
            ) : conversations.length === 0 ? (
              <p className="text-center text-xs" style={{ color: canvasTheme.node.faint }}>
                暂无历史对话
              </p>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => void loadConversationMessages(conv.id)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left text-xs transition hover:bg-white/5",
                    activeConversationId === conv.id && "border-indigo-500/50",
                  )}
                  style={{
                    borderColor: canvasTheme.node.stroke,
                    color: canvasTheme.node.text,
                  }}
                  data-testid="workflow-agent-history-item"
                >
                  <div className="font-medium">{conv.title}</div>
                  <div className="mt-0.5 text-[10px]" style={{ color: canvasTheme.node.faint }}>
                    {new Date(conv.updatedAt).toLocaleString()}
                  </div>
                </button>
              ))
            )}
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
              onClick={() => void handleApprovePending()}
              disabled={isRunning}
              className="flex-1 rounded-lg py-1.5 text-xs font-medium transition disabled:opacity-40"
              style={{ background: "#6366f1", color: "#fff" }}
              data-testid="workflow-agent-confirm"
            >
              确认
            </button>
            <button
              type="button"
              onClick={handleRejectPending}
              disabled={isRunning}
              className="flex-1 rounded-lg py-1.5 text-xs font-medium transition disabled:opacity-40"
              style={{ background: canvasTheme.node.panel, color: canvasTheme.node.muted }}
              data-testid="workflow-agent-cancel"
            >
              取消
            </button>
          </div>
        </div>
      )}

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
          data-testid="workflow-agent-input"
        />
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={!input.trim() || isRunning}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg font-medium transition disabled:opacity-30"
          style={{
            background: input.trim() && !isRunning ? "#6366f1" : canvasTheme.node.fill,
            color: input.trim() && !isRunning ? "#fff" : canvasTheme.node.faint,
          }}
          aria-label="发送"
          data-testid="workflow-agent-send"
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

function ChatMessageItem({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const isError = message.role === "error";

  return (
    <div className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-xs",
          isUser ? "rounded-br-md" : "rounded-bl-md",
        )}
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
        <p className="whitespace-pre-wrap">
          {message.text}
          {message.streaming ? (
            <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-current align-middle opacity-70" />
          ) : null}
        </p>
        {message.pending && <Loader2 className="mt-1 size-3 animate-spin" />}
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
