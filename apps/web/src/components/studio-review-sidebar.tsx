"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Circle,
  MessageSquare,
  Plus,
  Send,
  X,
  ChevronLeft,
  AtSign,
} from "lucide-react";
import {
  addWorkspaceReviewComment,
  createWorkspaceReview,
  fetchWorkspaceReviewComments,
  fetchWorkspaceReviews,
  patchWorkspaceReviewStatus,
} from "@/lib/api-client";
import type {
  WorkspaceReview,
  WorkspaceReviewComment,
  WorkspaceReviewTargetType,
} from "@/lib/types";

interface StudioReviewSidebarProps {
  workspaceId: string;
  projectId: string;
  runId?: string | null;
  members: Array<{ id: string; email: string }>;
  onClose?: () => void;
}

const TARGET_LABELS: Record<WorkspaceReviewTargetType, string> = {
  project: "项目",
  run: "成片",
  shot: "镜头",
};

function formatRelative(iso: string): string {
  const d = new Date(iso + (iso.endsWith("Z") ? "" : "Z"));
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`;
  return d.toLocaleDateString();
}

export function StudioReviewSidebar({
  workspaceId,
  projectId,
  runId,
  members,
  onClose,
}: StudioReviewSidebarProps) {
  const [reviews, setReviews] = useState<WorkspaceReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWorkspaceReviews(workspaceId, { projectId });
      setReviews(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载审片失败");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selected = reviews.find((r) => r.id === selectedReviewId) ?? null;

  async function handleCreate(input: {
    targetType: WorkspaceReviewTargetType;
    title: string;
    body: string;
  }) {
    setBusy(true);
    setError(null);
    try {
      await createWorkspaceReview(workspaceId, {
        projectId,
        runId: input.targetType === "run" ? runId ?? null : null,
        targetType: input.targetType,
        title: input.title,
        body: input.body || null,
      });
      setShowCreateForm(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleStatus(review: WorkspaceReview) {
    setBusy(true);
    setError(null);
    try {
      const next = review.status === "open" ? "resolved" : "open";
      await patchWorkspaceReviewStatus(workspaceId, review.id, next);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新状态失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full w-full flex-col bg-zinc-950/95 text-zinc-200">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          {selected && (
            <button
              type="button"
              onClick={() => setSelectedReviewId(null)}
              className="rounded p-1 hover:bg-white/10"
              aria-label="返回"
            >
              <ChevronLeft className="size-4" />
            </button>
          )}
          <h2 className="text-sm font-semibold">
            {selected ? selected.title : "审片评论"}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          {!selected && (
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="rounded p-1 hover:bg-white/10"
              aria-label="新建审片"
              disabled={busy}
            >
              <Plus className="size-4" />
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 hover:bg-white/10"
              aria-label="关闭"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {showCreateForm && !selected ? (
          <CreateReviewForm
            busy={busy}
            hasRun={Boolean(runId)}
            onCancel={() => setShowCreateForm(false)}
            onSubmit={handleCreate}
          />
        ) : selected ? (
          <ReviewDetail
            workspaceId={workspaceId}
            review={selected}
            members={members}
            busy={busy}
            onToggleStatus={() => handleToggleStatus(selected)}
          />
        ) : (
          <ReviewList
            reviews={reviews}
            loading={loading}
            onSelect={setSelectedReviewId}
          />
        )}
      </div>
    </div>
  );
}

function ReviewList({
  reviews,
  loading,
  onSelect,
}: {
  reviews: WorkspaceReview[];
  loading: boolean;
  onSelect: (id: string) => void;
}) {
  if (loading) {
    return (
      <div className="px-4 py-8 text-center text-xs text-zinc-500">加载中…</div>
    );
  }
  if (!reviews.length) {
    return (
      <div className="px-4 py-8 text-center text-xs text-zinc-500">
        暂无审片记录。点击右上角 + 新建一条。
      </div>
    );
  }
  return (
    <ul className="divide-y divide-white/5">
      {reviews.map((r) => (
        <li key={r.id}>
          <button
            type="button"
            onClick={() => onSelect(r.id)}
            className="flex w-full flex-col gap-1 px-4 py-3 text-left transition hover:bg-white/5"
          >
            <div className="flex items-center gap-2">
              {r.status === "open" ? (
                <Circle className="size-3.5 text-amber-400" />
              ) : (
                <CheckCircle2 className="size-3.5 text-emerald-400" />
              )}
              <span className="flex-1 truncate text-sm font-medium">
                {r.title}
              </span>
              {r.commentCount > 0 && (
                <span className="flex items-center gap-1 text-xs text-zinc-500">
                  <MessageSquare className="size-3" />
                  {r.commentCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span className="rounded bg-white/5 px-1.5 py-0.5">
                {TARGET_LABELS[r.targetType]}
              </span>
              <span className="truncate">@{r.createdByEmail}</span>
              <span>·</span>
              <span>{formatRelative(r.updatedAt)}</span>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function CreateReviewForm({
  busy,
  hasRun,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  hasRun: boolean;
  onCancel: () => void;
  onSubmit: (input: {
    targetType: WorkspaceReviewTargetType;
    title: string;
    body: string;
  }) => Promise<void> | void;
}) {
  const [targetType, setTargetType] = useState<WorkspaceReviewTargetType>("project");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      <div className="flex gap-2">
        {(["project", "run", "shot"] as const).map((t) => (
          <button
            key={t}
            type="button"
            disabled={t === "run" && !hasRun}
            onClick={() => setTargetType(t)}
            className={`rounded px-2 py-1 text-xs transition ${
              targetType === t
                ? "bg-violet-500/80 text-white"
                : "bg-white/5 text-zinc-400 hover:bg-white/10 disabled:opacity-40"
            }`}
          >
            {TARGET_LABELS[t]}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="审片标题（如：镜 3 节奏拖沓）"
        maxLength={200}
        className="rounded border border-white/10 bg-black/40 px-3 py-2 text-sm placeholder-zinc-600 focus:border-violet-400/50 focus:outline-none"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="详细说明（可选）"
        maxLength={4000}
        rows={4}
        className="rounded border border-white/10 bg-black/40 px-3 py-2 text-sm placeholder-zinc-600 focus:border-violet-400/50 focus:outline-none"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded px-3 py-1.5 text-xs text-zinc-400 hover:bg-white/5"
        >
          取消
        </button>
        <button
          type="button"
          disabled={busy || !title.trim()}
          onClick={() =>
            onSubmit({
              targetType,
              title: title.trim(),
              body: body.trim(),
            })
          }
          className="rounded bg-violet-500/80 px-3 py-1.5 text-xs text-white transition hover:bg-violet-500 disabled:opacity-40"
        >
          {busy ? "提交中…" : "创建"}
        </button>
      </div>
    </div>
  );
}

function ReviewDetail({
  workspaceId,
  review,
  members,
  busy,
  onToggleStatus,
}: {
  workspaceId: string;
  review: WorkspaceReview;
  members: Array<{ id: string; email: string }>;
  busy: boolean;
  onToggleStatus: () => void;
}) {
  const [comments, setComments] = useState<WorkspaceReviewComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [draft, setDraft] = useState("");
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [selectedMentions, setSelectedMentions] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);
  const draftRef = useRef<HTMLTextAreaElement>(null);

  const loadComments = useCallback(async () => {
    setLoadingComments(true);
    try {
      const data = await fetchWorkspaceReviewComments(workspaceId, review.id);
      setComments(data);
    } catch {
      // ignore
    } finally {
      setLoadingComments(false);
    }
  }, [workspaceId, review.id]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  function handleDraftChange(value: string) {
    setDraft(value);
    const lastAt = value.lastIndexOf("@");
    if (lastAt >= 0 && lastAt === value.length - 1) {
      setMentionOpen(true);
      setMentionQuery("");
    } else if (lastAt >= 0 && lastAt < value.length - 1) {
      const q = value.slice(lastAt + 1);
      if (!/\s/.test(q)) {
        setMentionOpen(true);
        setMentionQuery(q);
      } else {
        setMentionOpen(false);
      }
    } else {
      setMentionOpen(false);
    }
  }

  function pickMention(m: { id: string; email: string }) {
    const lastAt = draft.lastIndexOf("@");
    const next =
      lastAt >= 0 ? draft.slice(0, lastAt + 1) + m.email.split("@")[0] + " " : draft;
    setDraft(next);
    setSelectedMentions((prev) => (prev.includes(m.id) ? prev : [...prev, m.id]));
    setMentionOpen(false);
    draftRef.current?.focus();
  }

  async function handlePost() {
    if (!draft.trim()) return;
    setPosting(true);
    try {
      await addWorkspaceReviewComment(workspaceId, review.id, {
        content: draft.trim(),
        mentions: selectedMentions.length ? selectedMentions : undefined,
      });
      setDraft("");
      setSelectedMentions([]);
      await loadComments();
    } finally {
      setPosting(false);
    }
  }

  const filteredMembers = mentionQuery
    ? members.filter((m) =>
        m.email.toLowerCase().includes(mentionQuery.toLowerCase()),
      )
    : members;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/5 px-4 py-3">
        {review.body && (
          <p className="mb-2 whitespace-pre-wrap text-sm text-zinc-300">
            {review.body}
          </p>
        )}
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span>@{review.createdByEmail}</span>
          <span>·</span>
          <span>{formatRelative(review.createdAt)}</span>
          {review.resolvedAt && (
            <>
              <span>·</span>
              <span>已解决 by @{review.resolvedByEmail ?? "?"}</span>
            </>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleStatus}
            disabled={busy}
            className={`rounded px-2 py-1 text-xs transition ${
              review.status === "open"
                ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                : "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
            } disabled:opacity-40`}
          >
            {review.status === "open" ? "标记已解决" : "重新打开"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loadingComments ? (
          <div className="text-center text-xs text-zinc-500">加载评论…</div>
        ) : comments.length === 0 ? (
          <div className="text-center text-xs text-zinc-500">暂无评论</div>
        ) : (
          <ul className="space-y-3">
            {comments.map((c) => (
              <li key={c.id} className="rounded border border-white/5 bg-white/[0.02] p-2.5">
                <div className="mb-1 flex items-center gap-2 text-xs text-zinc-500">
                  <span className="text-zinc-300">@{c.userEmail}</span>
                  <span>·</span>
                  <span>{formatRelative(c.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-zinc-200">
                  {c.content}
                </p>
                {c.mentions.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {c.mentions.map((uid) => {
                      const m = members.find((x) => x.id === uid);
                      return (
                        <span
                          key={uid}
                          className="inline-flex items-center gap-0.5 rounded bg-violet-500/20 px-1.5 py-0.5 text-xs text-violet-300"
                        >
                          <AtSign className="size-2.5" />
                          {m?.email ?? uid.slice(0, 8)}
                        </span>
                      );
                    })}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="relative border-t border-white/10 px-4 py-3">
        {mentionOpen && filteredMembers.length > 0 && (
          <div className="absolute bottom-full left-4 right-4 mb-1 max-h-40 overflow-y-auto rounded border border-white/10 bg-zinc-900 py-1 shadow-lg">
            {filteredMembers.slice(0, 6).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => pickMention(m)}
                className="block w-full px-3 py-1.5 text-left text-xs hover:bg-white/5"
              >
                @{m.email}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={draftRef}
            value={draft}
            onChange={(e) => handleDraftChange(e.target.value)}
            placeholder="输入评论，@ 提及成员"
            rows={2}
            className="flex-1 resize-none rounded border border-white/10 bg-black/40 px-3 py-2 text-sm placeholder-zinc-600 focus:border-violet-400/50 focus:outline-none"
          />
          <button
            type="button"
            onClick={handlePost}
            disabled={posting || !draft.trim()}
            className="rounded bg-violet-500/80 p-2 text-white transition hover:bg-violet-500 disabled:opacity-40"
            aria-label="发送"
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
