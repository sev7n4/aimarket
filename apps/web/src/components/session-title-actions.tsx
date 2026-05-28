"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { deleteSession, updateSessionTitle } from "@/lib/api-client";

interface SessionTitleActionsProps {
  sessionId: string;
  title: string;
  /** header：工作台顶栏；row：侧栏列表；card：项目库卡片 */
  variant?: "header" | "row" | "card";
  disabled?: boolean;
  onTitleSaved?: (title: string) => void;
  onDeleted?: () => void;
}

export function SessionTitleActions({
  sessionId,
  title,
  variant = "header",
  disabled = false,
  onTitleSaved,
  onDeleted,
}: SessionTitleActionsProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(title);
  }, [title, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  async function saveTitle() {
    const next = draft.trim();
    if (!next || next === title) {
      setEditing(false);
      setDraft(title);
      return;
    }
    setSaving(true);
    try {
      const updated = await updateSessionTitle(sessionId, next);
      onTitleSaved?.(updated.title);
      setEditing(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "重命名失败");
      setDraft(title);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    if (!confirm("确定删除该项目？删除后无法恢复。")) return;
    try {
      await deleteSession(sessionId);
      onDeleted?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : "删除失败");
    }
  }

  function startEdit(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    setEditing(true);
  }

  const titleClass =
    variant === "header"
      ? "truncate text-sm font-medium text-zinc-100"
      : variant === "card"
        ? "truncate font-medium"
        : "truncate font-medium";
  const actionClass =
    variant === "row"
      ? "opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:focus:opacity-100"
      : "opacity-0 group-hover:opacity-100 focus:opacity-100";

  if (editing) {
    return (
      <div
        className="flex min-w-0 flex-1 items-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={100}
          disabled={saving}
          onKeyDown={(e) => {
            if (e.key === "Enter") void saveTitle();
            if (e.key === "Escape") {
              setDraft(title);
              setEditing(false);
            }
          }}
          onBlur={() => void saveTitle()}
          className={`min-w-0 flex-1 rounded-lg border border-orange-500/40 bg-black/50 px-2 py-1 outline-none ${
            variant === "header" ? "text-sm" : "text-xs"
          }`}
        />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-0.5">
      <span className={`min-w-0 flex-1 ${titleClass}`}>{title}</span>
      {!disabled ? (
        <>
          <button
            type="button"
            onClick={startEdit}
            title="重命名"
            aria-label="重命名"
            className={`shrink-0 rounded p-1 text-zinc-500 transition hover:bg-white/10 hover:text-zinc-300 ${actionClass}`}
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => void handleDelete(e)}
            title="删除项目"
            aria-label="删除项目"
            className={`shrink-0 rounded p-1 text-zinc-500 transition hover:bg-red-500/20 hover:text-red-400 ${actionClass}`}
          >
            <Trash2 className="size-3.5" />
          </button>
        </>
      ) : null}
    </div>
  );
}
