"use client";

import { useCallback, useEffect, useState } from "react";
import { History, RotateCcw, X, GitCompare } from "lucide-react";
import {
  diffDramaProjectVersions,
  fetchDramaProjectVersion,
  fetchDramaProjectVersions,
  restoreDramaProjectVersion,
} from "@/lib/api-client";
import type {
  DramaProjectVersionDiff,
  DramaProjectVersionSummary,
} from "@/lib/types";

interface DramaVersionHistoryProps {
  projectId: string;
  onClose: () => void;
  /** 回滚成功后通知父组件刷新 project */
  onRestored?: () => void;
}

const TRIGGER_LABEL: Record<string, string> = {
  initial: "初始",
  manual_patch: "手动编辑",
  auto_save: "自动保存",
  restore: "回滚",
};

const TRIGGER_COLOR: Record<string, string> = {
  initial: "bg-zinc-500/15 text-zinc-300",
  manual_patch: "bg-violet-500/15 text-violet-200",
  auto_save: "bg-blue-500/15 text-blue-200",
  restore: "bg-amber-500/15 text-amber-200",
};

function formatTime(iso: string): string {
  try {
    const d = new Date(iso.endsWith("Z") ? iso : iso + "Z");
    return d.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function DramaVersionHistory({
  projectId,
  onClose,
  onRestored,
}: DramaVersionHistoryProps) {
  const [versions, setVersions] = useState<DramaProjectVersionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [diff, setDiff] = useState<DramaProjectVersionDiff | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [restoreNote, setRestoreNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDramaProjectVersions(projectId);
      setVersions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载版本失败");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  // 计算两版本 diff
  useEffect(() => {
    if (!selectedId || !compareId || selectedId === compareId) {
      setDiff(null);
      return;
    }
    let cancelled = false;
    void diffDramaProjectVersions(projectId, compareId, selectedId)
      .then((d) => {
        if (!cancelled) setDiff(d);
      })
      .catch(() => {
        if (!cancelled) setDiff(null);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, selectedId, compareId]);

  async function handleRestore(versionId: string) {
    if (!confirm("确认回滚到此版本？当前状态会被自动保存为新版本。")) return;
    setRestoring(versionId);
    setError(null);
    try {
      await restoreDramaProjectVersion(projectId, versionId, restoreNote.trim() || undefined);
      setRestoreNote("");
      await load();
      onRestored?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "回滚失败");
    } finally {
      setRestoring(null);
    }
  }

  return (
    <div
      className="flex h-full flex-col bg-zinc-950/95 text-zinc-200"
      data-testid="drama-version-history"
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <History className="size-4 text-violet-300" />
          <h3 className="text-sm font-medium">历史版本</h3>
          {versions.length > 0 ? (
            <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-400">
              {versions.length}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-zinc-500 transition hover:bg-white/5 hover:text-white"
          aria-label="关闭"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        {loading ? (
          <p className="px-2 py-4 text-xs text-zinc-500">加载中…</p>
        ) : error ? (
          <div className="mb-2 rounded border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-xs text-red-300">
            {error}
          </div>
        ) : versions.length === 0 ? (
          <p className="px-2 py-4 text-xs text-zinc-500">暂无版本记录</p>
        ) : (
          <ul className="space-y-1.5">
            {versions.map((v, idx) => {
              const isSelected = selectedId === v.id;
              const isCompare = compareId === v.id;
              return (
                <li
                  key={v.id}
                  className={`rounded-lg border px-2.5 py-2 transition ${
                    v.isCurrent
                      ? "border-violet-500/40 bg-violet-500/[0.06]"
                      : "border-white/10 bg-black/30"
                  } ${isSelected ? "ring-1 ring-blue-500/40" : ""} ${isCompare ? "ring-1 ring-amber-500/40" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-zinc-500">
                          #{versions.length - idx}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] ${
                            TRIGGER_COLOR[v.trigger] ?? "bg-white/5 text-zinc-400"
                          }`}
                        >
                          {TRIGGER_LABEL[v.trigger] ?? v.trigger}
                        </span>
                        {v.isCurrent ? (
                          <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] text-violet-200">
                            当前
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[11px] text-zinc-400">
                        {formatTime(v.createdAt)}
                      </p>
                      {v.note ? (
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-zinc-500">
                          {v.note}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedId(isSelected ? null : v.id)}
                      className={`rounded px-1.5 py-0.5 text-[10px] transition ${
                        isSelected
                          ? "bg-blue-500/20 text-blue-200"
                          : "bg-white/5 text-zinc-400 hover:bg-white/10"
                      }`}
                    >
                      预览
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCompareId(isCompare ? null : v.id)
                      }
                      className={`flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] transition ${
                        isCompare
                          ? "bg-amber-500/20 text-amber-200"
                          : "bg-white/5 text-zinc-400 hover:bg-white/10"
                      }`}
                      title="选择两个版本进行对比"
                    >
                      <GitCompare className="size-2.5" />
                      对比
                    </button>
                    {!v.isCurrent ? (
                      <button
                        type="button"
                        onClick={() => void handleRestore(v.id)}
                        disabled={restoring === v.id}
                        className="ml-auto flex items-center gap-0.5 rounded bg-orange-500/15 px-1.5 py-0.5 text-[10px] text-orange-200 transition hover:bg-orange-500/25 disabled:opacity-50"
                      >
                        <RotateCcw className="size-2.5" />
                        {restoring === v.id ? "回滚中…" : "回滚"}
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {selectedId ? (
        <PreviewPanel
          projectId={projectId}
          versionId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      ) : null}

      {diff ? (
        <div className="border-t border-white/10 bg-black/40 px-3 py-2 text-[11px]">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-medium text-zinc-300">版本对比</span>
            <button
              type="button"
              onClick={() => {
                setCompareId(null);
                setDiff(null);
              }}
              className="text-zinc-500 hover:text-white"
              title="关闭对比"
              aria-label="关闭对比"
            >
              <X className="size-3" />
            </button>
          </div>
          <div className="flex gap-2 text-[10px]">
            <span className="text-emerald-300">+{diff.stats.added} 新增</span>
            <span className="text-amber-300">~{diff.stats.modified} 修改</span>
            <span className="text-red-300">-{diff.stats.removed} 删除</span>
          </div>
          {diff.changedPaths.length > 0 ? (
            <details className="mt-1">
              <summary className="cursor-pointer text-[10px] text-zinc-500">
                查看变更路径 ({diff.changedPaths.length})
              </summary>
              <ul className="mt-1 max-h-24 overflow-y-auto rounded bg-black/40 p-1.5 font-mono text-[9px] text-zinc-400">
                {diff.changedPaths.slice(0, 50).map((p) => (
                  <li key={p} className="truncate">
                    {p}
                  </li>
                ))}
                {diff.changedPaths.length > 50 ? (
                  <li className="text-zinc-600">
                    …还有 {diff.changedPaths.length - 50} 项
                  </li>
                ) : null}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}

      {restoring ? (
        <div className="border-t border-white/10 bg-black/40 px-3 py-2">
          <input
            type="text"
            value={restoreNote}
            onChange={(e) => setRestoreNote(e.target.value)}
            placeholder="回滚备注（可选）"
            className="w-full rounded border border-white/10 bg-black/50 px-2 py-1 text-[11px] text-zinc-200"
            maxLength={200}
          />
        </div>
      ) : null}
    </div>
  );
}

function PreviewPanel({
  projectId,
  versionId,
  onClose,
}: {
  projectId: string;
  versionId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<{
    script: { title?: string; logline?: string };
    shots?: Array<{ id?: string; description?: string }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchDramaProjectVersion(projectId, versionId)
      .then((d) => {
        if (!cancelled) {
          setData({
            script: {
              title: d.project.project.script.title,
              logline: d.project.project.script.logline,
            },
            shots: d.project.project.shots,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, versionId]);

  return (
    <div className="border-t border-white/10 bg-black/40 px-3 py-2 text-[11px]">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-medium text-zinc-300">版本预览</span>
        <button
          type="button"
          onClick={onClose}
          className="text-zinc-500 hover:text-white"
          title="关闭预览"
          aria-label="关闭预览"
        >
          <X className="size-3" />
        </button>
      </div>
      {loading ? (
        <p className="text-[10px] text-zinc-500">加载中…</p>
      ) : data ? (
        <div className="space-y-1">
          <p className="text-zinc-300">
            <span className="text-zinc-500">标题：</span>
            {data.script.title ?? "—"}
          </p>
          <p className="text-zinc-400">
            <span className="text-zinc-500">梗概：</span>
            {data.script.logline ?? "—"}
          </p>
          <p className="text-zinc-500">
            镜头数：{data.shots?.length ?? 0}
          </p>
        </div>
      ) : (
        <p className="text-[10px] text-red-300">加载失败</p>
      )}
    </div>
  );
}
