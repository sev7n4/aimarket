"use client";

import { ChevronRight, Loader2, PanelRightClose, PanelRightOpen } from "lucide-react";
import { CreationPanel } from "@/components/creation-panel";
import { StudioToolGrid } from "@/components/studio-tool-grid";
import { ModeTabs, type CreationMode } from "@aimarket/ui";
import { modeTabs } from "@/lib/modes";
import { LABELS, chatEmptyHint } from "@/lib/mobile-labels";
import { BRAND_NAME } from "@/lib/brand";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { MOBILE_BREAKPOINT } from "@/lib/breakpoints";
import type { PendingAsset } from "@/lib/pending-assets";
import type { ChatMessage, StudioTool } from "@/lib/types";

interface WorkbenchPanelProps {
  open: boolean;
  onToggle: () => void;
  sessionTitle: string;
  mode: CreationMode;
  onModeChange: (m: CreationMode) => void;
  sessionId: string;
  initialPrompt: string;
  restoredAssets?: PendingAsset[];
  messages: ChatMessage[];
  showEmpty: boolean;
  pollingJobId: string | null;
  jobStreamStatus?: string | null;
  tools: StudioTool[];
  activeTool: StudioTool | null;
  toolPrompt: string;
  toolPending: boolean;
  onToolPromptChange: (v: string) => void;
  onToolSelect: (t: StudioTool) => void;
  onToolCancel: () => void;
  onToolRun: () => void;
  onAuthRequired: () => void;
  onJobStarted: (jobId: string) => void;
  userReady: boolean;
  onLogin: () => void;
  readOnly?: boolean;
}

export function WorkbenchPanel({
  open,
  onToggle,
  sessionTitle,
  mode,
  onModeChange,
  sessionId,
  initialPrompt,
  restoredAssets,
  messages,
  showEmpty,
  pollingJobId,
  jobStreamStatus,
  tools,
  activeTool,
  toolPrompt,
  toolPending,
  onToolPromptChange,
  onToolSelect,
  onToolCancel,
  onToolRun,
  onAuthRequired,
  onJobStarted,
  userReady,
  onLogin,
  readOnly = false,
}: WorkbenchPanelProps) {
  const mobile = useIsMobile(MOBILE_BREAKPOINT);

  if (!open) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-1 rounded-full border border-white/10 bg-[#141414]/95 px-4 py-2.5 text-xs text-zinc-300 shadow-lg backdrop-blur hover:text-white md:absolute md:bottom-auto md:right-3 md:top-20"
      >
        <PanelRightOpen className="size-4" />
        {LABELS.chatPanelShort}
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        aria-label={LABELS.closeChatPanel}
        className="fixed inset-0 z-40 bg-black/50 md:hidden"
        onClick={onToggle}
      />
      <aside className="relative z-50 flex w-full shrink-0 flex-col border-l border-white/5 bg-[#0a0a0a] max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:max-h-[min(78vh,560px)] max-md:rounded-t-2xl max-md:border-t max-md:shadow-2xl md:w-[min(420px,38vw)]">
        <div
          className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-white/20 max-md:block md:hidden"
          aria-hidden
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute -left-3 top-4 z-10 flex size-6 items-center justify-center rounded-full border border-white/10 bg-[#141414] text-zinc-500 hover:text-white max-md:hidden"
          title={LABELS.closeChatPanel}
        >
          <ChevronRight className="size-3.5" />
        </button>

        <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-4 py-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-600">
              {LABELS.chatPanel}
            </p>
            <p className="text-sm font-medium text-zinc-200">{sessionTitle}</p>
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="rounded-lg p-2 text-zinc-500 hover:bg-white/5"
            title={LABELS.closeChatPanel}
          >
            <PanelRightClose className="size-4" />
          </button>
        </div>

        <div className="shrink-0 border-b border-white/5 px-3 py-2">
          <ModeTabs
            items={modeTabs}
            value={mode}
            onChange={readOnly ? () => {} : onModeChange}
            className="w-full justify-center"
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-3">
          {activeTool ? (
            <div className="mb-3 rounded-xl border border-purple-500/30 bg-purple-500/5 p-3">
              <h3 className="text-sm font-medium text-purple-200">
                {activeTool.name}
              </h3>
              <p className="mt-1 text-xs text-zinc-500">
                {activeTool.description}
              </p>
              {activeTool.clientOnly ? (
                <p className="mt-2 text-xs text-amber-400/90">
                  仅在画布客户端裁剪，不会创建 AI 任务
                </p>
              ) : activeTool.requiresSource ? (
                <p className="mt-2 text-xs text-zinc-500">
                  {mobile
                    ? "请先在上方画布点选一张图片作为参考"
                    : "请先在左侧画布选中一张图片作为参考"}
                </p>
              ) : null}
              <textarea
                value={toolPrompt}
                onChange={(e) => onToolPromptChange(e.target.value)}
                readOnly={readOnly}
                rows={2}
                className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs outline-none"
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={onToolRun}
                  disabled={readOnly || toolPending}
                  className="rounded-full bg-gradient-to-r from-orange-500 to-purple-600 px-3 py-1 text-xs font-medium disabled:opacity-50"
                >
                  {toolPending
                    ? "执行中…"
                    : activeTool.clientOnly
                      ? "画布裁剪"
                      : "运行"}
                </button>
                <button
                  type="button"
                  onClick={onToolCancel}
                  className="text-xs text-zinc-500"
                >
                  取消
                </button>
              </div>
            </div>
          ) : null}

          {showEmpty ? (
            <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
              <p className="text-3xl" aria-hidden>
                😊
              </p>
              <h2 className="mt-3 text-lg font-semibold">Hi，我是{BRAND_NAME}</h2>
              <p className="mt-2 text-xs text-zinc-500">
                {chatEmptyHint(mobile)}
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {messages.map((msg) => (
                <li
                  key={msg.id}
                  className={`rounded-xl px-3 py-2 text-xs ${
                    msg.role === "user"
                      ? "ml-4 bg-white/10 text-zinc-200"
                      : "mr-2 border border-white/5 bg-white/[0.02] text-zinc-400"
                  }`}
                >
                  <p className="line-clamp-4 whitespace-pre-wrap">
                    {msg.content}
                  </p>
                  {msg.outputs?.length ? (
                    <p className="mt-1 text-[10px] text-orange-400/80">
                      → {msg.outputs.length} 张已上画布
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {pollingJobId && jobStreamStatus ? (
            <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
              <Loader2 className="size-3.5 animate-spin text-orange-400" />
              {jobStreamStatus === "queued"
                ? "排队中…"
                : jobStreamStatus === "running"
                  ? "生成中…"
                  : jobStreamStatus === "failed"
                    ? "生成失败"
                    : "处理中…"}
            </div>
          ) : null}
        </div>

        <div className="shrink-0 overflow-visible border-t border-white/5 p-3">
          {!userReady ? (
            <button
              type="button"
              onClick={onLogin}
              className="mb-2 w-full text-center text-xs text-orange-400"
            >
              登录后开始创作
            </button>
          ) : null}
          {readOnly ? (
            <p className="mb-2 text-center text-xs text-amber-400/90">
              只读会话：无法在此生成或编辑
            </p>
          ) : null}
          <CreationPanel
            variant="dock"
            showModeTabs={false}
            rotatingPlaceholder
            enablePolish
            mode={mode}
            onModeChange={onModeChange}
            sessionId={sessionId}
            initialPrompt={initialPrompt}
            restoredAssets={restoredAssets}
            onAuthRequired={onAuthRequired}
            onJobStarted={onJobStarted}
            jobStreamStatus={jobStreamStatus}
            readOnly={readOnly}
          />
          {mode !== "ecommerce" ? (
            <StudioToolGrid
              tools={tools}
              activeToolId={activeTool?.id}
              disabled={readOnly || toolPending || Boolean(pollingJobId)}
              onSelect={onToolSelect}
            />
          ) : null}
        </div>
      </aside>
    </>
  );
}
