"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GripVertical, Loader2, Plus } from "lucide-react";
import type {
  DramaCharacterCard,
  DramaProjectPayload,
  DramaStoryboardShot,
} from "@/lib/types";
import {
  createDramaShot,
  reorderDramaShots,
  shotDialogueLine,
  shotThumbnailUrl,
  sortDramaShots,
} from "@/lib/drama-shot-helpers";

interface DramaShotTimelineProps {
  project: DramaProjectPayload;
  readOnly?: boolean;
  busy?: boolean;
  onProjectChange: (project: DramaProjectPayload) => void;
  onSave?: (project: DramaProjectPayload) => void | Promise<unknown>;
  saveDebounceMs?: number;
}

function characterNames(
  shot: DramaStoryboardShot,
  characters: DramaCharacterCard[],
): string {
  const names = shot.characterIds
    .map((id) => characters.find((c) => c.id === id)?.name)
    .filter(Boolean);
  return names.length ? names.join("、") : "—";
}

function sceneLabel(
  sceneId: string,
  scenes: DramaProjectPayload["scenes"],
): string {
  return scenes.find((s) => s.id === sceneId)?.name ?? (sceneId || "—");
}

export function DramaShotTimeline({
  project,
  readOnly,
  busy,
  onProjectChange,
  onSave,
  saveDebounceMs = 500,
}: DramaShotTimelineProps) {
  const sorted = useMemo(
    () => sortDramaShots(project.shots),
    [project.shots],
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    sorted[0]?.id ?? null,
  );
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!selectedId && sorted[0]) {
      setSelectedId(sorted[0].id);
      return;
    }
    if (selectedId && !sorted.some((s) => s.id === selectedId)) {
      setSelectedId(sorted[0]?.id ?? null);
    }
  }, [selectedId, sorted]);

  const selectedShot = sorted.find((s) => s.id === selectedId) ?? null;

  const scheduleSave = useCallback(
    (next: DramaProjectPayload) => {
      if (!onSave) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        setSaving(true);
        void Promise.resolve(onSave(next)).finally(() => setSaving(false));
      }, saveDebounceMs);
    },
    [onSave, saveDebounceMs],
  );

  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    },
    [],
  );

  const applyShots = useCallback(
    (shots: DramaStoryboardShot[]) => {
      const next = { ...project, shots };
      onProjectChange(next);
      scheduleSave(next);
    },
    [onProjectChange, project, scheduleSave],
  );

  const updateShot = useCallback(
    (shotId: string, patch: Partial<DramaStoryboardShot>) => {
      applyShots(
        project.shots.map((s) => (s.id === shotId ? { ...s, ...patch } : s)),
      );
    },
    [applyShots, project.shots],
  );

  const handleDrop = useCallback(
    (toIndex: number) => {
      if (readOnly || dragIndex == null || dragIndex === toIndex) {
        setDragIndex(null);
        setDropIndex(null);
        return;
      }
      applyShots(reorderDramaShots(project.shots, dragIndex, toIndex));
      setDragIndex(null);
      setDropIndex(null);
    },
    [applyShots, dragIndex, project.shots, readOnly],
  );

  const handleAddShot = useCallback(() => {
    if (readOnly || project.shots.length >= 15) return;
    const shot = createDramaShot(project.shots);
    applyShots([...project.shots, shot]);
    setSelectedId(shot.id);
  }, [applyShots, project.shots, readOnly]);

  return (
    <div
      className="flex min-h-0 flex-1 flex-col rounded-xl border border-violet-500/20 bg-violet-500/[0.03] p-3 sm:p-4"
      data-testid="drama-shot-timeline"
    >
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-violet-200">分镜时间线</h3>
          <p className="text-[11px] text-zinc-500">
            {project.script.title || "AI 短剧"} · {sorted.length} 镜
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-zinc-500">
          {saving || busy ? (
            <span className="inline-flex items-center gap-1 text-violet-300/80">
              <Loader2 className="size-3 animate-spin" />
              保存中…
            </span>
          ) : onSave ? (
            <span>编辑自动保存</span>
          ) : null}
        </div>
      </header>

      <div
        className="mb-4 flex gap-2 overflow-x-auto pb-2"
        data-testid="drama-shot-track"
      >
        {sorted.map((shot, index) => {
          const selected = shot.id === selectedId;
          const thumb = shotThumbnailUrl(shot);
          const dialogue = shotDialogueLine(shot);
          const isDropTarget = dropIndex === index && dragIndex !== index;

          return (
            <div
              key={shot.id}
              className={`relative flex shrink-0 flex-col ${
                isDropTarget ? "opacity-80" : ""
              }`}
              onDragOver={(e) => {
                if (readOnly) return;
                e.preventDefault();
                setDropIndex(index);
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(index);
              }}
            >
              {isDropTarget ? (
                <div className="absolute -left-1 top-2 bottom-2 w-0.5 rounded bg-violet-400" />
              ) : null}
              <button
                type="button"
                draggable={!readOnly}
                onDragStart={() => !readOnly && setDragIndex(index)}
                onDragEnd={() => {
                  setDragIndex(null);
                  setDropIndex(null);
                }}
                onClick={() => setSelectedId(shot.id)}
                data-testid={`drama-shot-card-${shot.order + 1}`}
                className={`flex w-[7.5rem] flex-col overflow-hidden rounded-lg border text-left transition sm:w-[8.5rem] ${
                  selected
                    ? "border-violet-400/60 bg-violet-500/10 ring-1 ring-violet-400/30"
                    : "border-white/10 bg-black/30 hover:border-white/20"
                } ${dragIndex === index ? "opacity-50" : ""}`}
              >
                <div className="relative aspect-[9/16] w-full bg-black/50">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] text-zinc-600">
                      待生成
                    </div>
                  )}
                  {!readOnly ? (
                    <span className="absolute left-1 top-1 rounded bg-black/60 p-0.5 text-zinc-400">
                      <GripVertical className="size-3" />
                    </span>
                  ) : null}
                  <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[9px] text-zinc-300">
                    {shot.durationSec}s
                  </span>
                </div>
                <div className="space-y-0.5 p-2">
                  <div className="text-[11px] font-medium text-zinc-200">
                    S{shot.order + 1}
                  </div>
                  <p className="line-clamp-2 text-[10px] text-zinc-500">
                    {dialogue ? `「${dialogue}」` : shot.visualPrompt}
                  </p>
                </div>
              </button>
            </div>
          );
        })}

        {!readOnly && project.shots.length < 15 ? (
          <button
            type="button"
            onClick={handleAddShot}
            data-testid="drama-shot-add"
            className="flex h-[calc(7.5rem*16/9+3.5rem)] w-[7.5rem] shrink-0 flex-col items-center justify-center rounded-lg border border-dashed border-white/15 text-zinc-500 hover:border-violet-400/40 hover:bg-violet-500/5 hover:text-violet-300 sm:w-[8.5rem]"
          >
            <Plus className="mb-1 size-5" />
            <span className="text-[10px]">添加镜头</span>
          </button>
        ) : null}
      </div>

      {selectedShot ? (
        <section
          className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-white/5 bg-black/25 p-3"
          data-testid="drama-shot-detail"
        >
          <h4 className="mb-2 text-xs font-medium text-zinc-300">
            选中 S{selectedShot.order + 1}
          </h4>
          <dl className="grid gap-2 text-[11px] sm:grid-cols-2">
            <div>
              <dt className="text-zinc-600">场景</dt>
              <dd className="text-zinc-300">
                {sceneLabel(selectedShot.sceneId, project.scenes)}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-600">角色</dt>
              <dd className="text-zinc-300">
                {characterNames(selectedShot, project.characters)}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="mb-1 text-zinc-600">对白</dt>
              <dd>
                {readOnly ? (
                  <p className="text-violet-300/90">
                    {shotDialogueLine(selectedShot)
                      ? `「${shotDialogueLine(selectedShot)}」`
                      : "—"}
                  </p>
                ) : (
                  <input
                    className="w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-zinc-200"
                    value={selectedShot.dialogue[0]?.line ?? ""}
                    placeholder="对白（可选）"
                    onChange={(e) => {
                      const line = e.target.value;
                      const characterId =
                        selectedShot.dialogue[0]?.characterId ??
                        selectedShot.characterIds[0] ??
                        "";
                      updateShot(selectedShot.id, {
                        dialogue: line
                          ? [{ characterId, line }]
                          : [],
                      });
                    }}
                  />
                )}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="mb-1 text-zinc-600">画面</dt>
              <dd>
                {readOnly ? (
                  <p className="text-zinc-400">{selectedShot.visualPrompt}</p>
                ) : (
                  <textarea
                    className="min-h-[72px] w-full resize-y rounded border border-white/10 bg-black/40 px-2 py-1 text-zinc-200"
                    value={selectedShot.visualPrompt}
                    onChange={(e) =>
                      updateShot(selectedShot.id, {
                        visualPrompt: e.target.value,
                      })
                    }
                  />
                )}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-600">景别</dt>
              <dd className="text-zinc-300">
                {readOnly ? (
                  selectedShot.cameraSpec.shotSize
                ) : (
                  <input
                    className="w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-zinc-200"
                    value={selectedShot.cameraSpec.shotSize}
                    onChange={(e) =>
                      updateShot(selectedShot.id, {
                        cameraSpec: {
                          ...selectedShot.cameraSpec,
                          shotSize: e.target.value,
                        },
                      })
                    }
                  />
                )}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-600">运镜</dt>
              <dd className="text-zinc-300">
                {readOnly ? (
                  selectedShot.cameraSpec.movement
                ) : (
                  <input
                    className="w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-zinc-200"
                    value={selectedShot.cameraSpec.movement}
                    onChange={(e) =>
                      updateShot(selectedShot.id, {
                        cameraSpec: {
                          ...selectedShot.cameraSpec,
                          movement: e.target.value,
                        },
                      })
                    }
                  />
                )}
              </dd>
            </div>
            {!readOnly ? (
              <div>
                <dt className="mb-1 text-zinc-600">时长（秒）</dt>
                <dd>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    className="w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-zinc-200"
                    value={selectedShot.durationSec}
                    onChange={(e) =>
                      updateShot(selectedShot.id, {
                        durationSec: Math.max(
                          1,
                          Math.min(30, Number(e.target.value) || 1),
                        ),
                      })
                    }
                  />
                </dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}
    </div>
  );
}
