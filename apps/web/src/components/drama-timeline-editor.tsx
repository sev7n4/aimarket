"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, GripVertical, Trash2, Plus } from "lucide-react";
import type {
  DramaProjectPayload,
  DramaStoryboardShot,
  DramaTimelineClip,
  DramaTimelineTrack,
} from "@/lib/types";
import { shotDialogueLine, shotThumbnailUrl, sortDramaShots } from "@/lib/drama-shot-helpers";

interface DramaTimelineEditorProps {
  project: DramaProjectPayload;
  readOnly?: boolean;
  busy?: boolean;
  onProjectChange: (project: DramaProjectPayload) => void;
  onSave?: (project: DramaProjectPayload) => void | Promise<unknown>;
  saveDebounceMs?: number;
}

const TRACK_COLORS: Record<DramaTimelineTrack["type"], string> = {
  video: "bg-violet-500/70 border-violet-400/50",
  audio_dialogue: "bg-amber-500/70 border-amber-400/50",
  audio_bgm: "bg-emerald-500/70 border-emerald-400/50",
};

const TRACK_LABELS: Record<DramaTimelineTrack["type"], string> = {
  video: "视频轨",
  audio_dialogue: "配音轨",
  audio_bgm: "BGM 轨",
};

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function generateId(): string {
  return `tl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function buildInitialTimeline(project: DramaProjectPayload): DramaTimelineTrack[] {
  const sortedShots = sortDramaShots(project.shots);
  let timeOffset = 0;

  const videoTrack: DramaTimelineTrack = {
    id: "track_video",
    type: "video",
    label: "视频",
    clips: sortedShots.map((shot) => {
      const clip: DramaTimelineClip = {
        id: `clip_${shot.id}`,
        trackId: "track_video",
        sourceId: shot.id,
        startSec: 0,
        durationSec: shot.durationSec,
        offsetSec: timeOffset,
        volume: 1,
      };
      timeOffset += shot.durationSec;
      return clip;
    }),
  };

  const dialogueTrack: DramaTimelineTrack = {
    id: "track_dialogue",
    type: "audio_dialogue",
    label: "配音",
    clips: sortedShots
      .filter((shot) => shot.dialogue.length > 0)
      .map((shot) => ({
        id: `clip_dialogue_${shot.id}`,
        trackId: "track_dialogue",
        sourceId: shot.id,
        startSec: 0,
        durationSec: shot.durationSec,
        offsetSec: sortedShots.findIndex((s) => s.id === shot.id) * 5,
        volume: 1,
      })),
  };

  const bgmTrack: DramaTimelineTrack = {
    id: "track_bgm",
    type: "audio_bgm",
    label: "BGM",
    clips: project.productionParams?.bgmUrl
      ? [
          {
            id: "clip_bgm_main",
            trackId: "track_bgm",
            startSec: 0,
            durationSec: project.targetDurationSec,
            offsetSec: 0,
            volume: 0.5,
          },
        ]
      : [],
  };

  return [videoTrack, dialogueTrack, bgmTrack];
}

export function DramaTimelineEditor({
  project,
  readOnly,
  busy,
  onProjectChange,
  onSave,
  saveDebounceMs = 500,
}: DramaTimelineEditorProps) {
  const [timeline, setTimeline] = useState<DramaTimelineTrack[]>(() =>
    project.timeline?.length ? project.timeline : buildInitialTimeline(project),
  );
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<{
    clipId: string;
    trackId: string;
    startX: number;
    startOffset: number;
  } | null>(null);
  const [scrubberTime, setScrubberTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalDuration = useMemo(() => {
    let maxEnd = 0;
    for (const track of timeline) {
      for (const clip of track.clips) {
        maxEnd = Math.max(maxEnd, clip.offsetSec + clip.durationSec);
      }
    }
    return maxEnd || project.targetDurationSec;
  }, [timeline, project.targetDurationSec]);

  useEffect(() => {
    if (!project.timeline?.length) {
      setTimeline(buildInitialTimeline(project));
    }
  }, [project.shots.length]);

  useEffect(() => {
    if (isPlaying) {
      playIntervalRef.current = setInterval(() => {
        setScrubberTime((prev) => {
          if (prev >= totalDuration) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 0.1;
        });
      }, 100);
    } else {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
    }
    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, [isPlaying, totalDuration]);

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

  const applyTimeline = useCallback(
    (nextTimeline: DramaTimelineTrack[]) => {
      setTimeline(nextTimeline);
      const nextProject = { ...project, timeline: nextTimeline };
      onProjectChange(nextProject);
      scheduleSave(nextProject);
    },
    [onProjectChange, project, scheduleSave],
  );

  const updateClip = useCallback(
    (clipId: string, trackId: string, patch: Partial<DramaTimelineClip>) => {
      applyTimeline(
        timeline.map((track) =>
          track.id === trackId
            ? {
                ...track,
                clips: track.clips.map((clip) =>
                  clip.id === clipId ? { ...clip, ...patch } : clip,
                ),
              }
            : track,
        ),
      );
    },
    [applyTimeline, timeline],
  );

  const deleteClip = useCallback(
    (clipId: string, trackId: string) => {
      applyTimeline(
        timeline.map((track) =>
          track.id === trackId
            ? { ...track, clips: track.clips.filter((c) => c.id !== clipId) }
            : track,
        ),
      );
      if (selectedClipId === clipId) setSelectedClipId(null);
    },
    [applyTimeline, timeline, selectedClipId],
  );

  const addClip = useCallback(
    (trackId: string) => {
      const track = timeline.find((t) => t.id === trackId);
      if (!track) return;

      const newClip: DramaTimelineClip = {
        id: generateId(),
        trackId,
        startSec: 0,
        durationSec: 5,
        offsetSec: totalDuration,
        volume: track.type === "audio_bgm" ? 0.5 : 1,
      };

      applyTimeline(
        timeline.map((t) =>
          t.id === trackId ? { ...t, clips: [...t.clips, newClip] } : t,
        ),
      );
      setSelectedClipId(newClip.id);
    },
    [applyTimeline, timeline, totalDuration],
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent, clipId: string, trackId: string, offsetSec: number) => {
      if (readOnly) return;
      e.dataTransfer.effectAllowed = "move";
      setDragState({ clipId, trackId, startX: e.clientX, startOffset: offsetSec });
    },
    [readOnly],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
    },
    [],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, trackId: string) => {
      if (!dragState || readOnly) {
        setDragState(null);
        return;
      }
      e.preventDefault();

      const container = containerRef.current;
      if (!container) {
        setDragState(null);
        return;
      }

      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = x / rect.width;
      const newOffset = Math.max(0, percentage * totalDuration);

      updateClip(dragState.clipId, dragState.trackId, {
        offsetSec: Math.round(newOffset * 10) / 10,
      });

      setDragState(null);
    },
    [dragState, readOnly, totalDuration, updateClip],
  );

  const handleScrubberClick = useCallback(
    (e: React.MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = x / rect.width;
      setScrubberTime(Math.max(0, Math.min(totalDuration, percentage * totalDuration)));
      setIsPlaying(false);
    },
    [totalDuration],
  );

  const selectedClip = useMemo(() => {
    for (const track of timeline) {
      const clip = track.clips.find((c) => c.id === selectedClipId);
      if (clip) return { clip, track };
    }
    return null;
  }, [timeline, selectedClipId]);

  const selectedShot = useMemo(() => {
    if (!selectedClip?.clip.sourceId) return null;
    return project.shots.find((s) => s.id === selectedClip.clip.sourceId) ?? null;
  }, [selectedClip, project.shots]);

  const timeMarkers = useMemo(() => {
    const markers = [];
    for (let i = 0; i <= totalDuration; i += 5) {
      markers.push(i);
    }
    return markers;
  }, [totalDuration]);

  return (
    <div
      className="flex min-h-0 flex-1 flex-col rounded-xl border border-violet-500/20 bg-violet-500/[0.03] p-3 sm:p-4"
      data-testid="drama-timeline-editor"
    >
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-violet-200">时间轴剪辑</h3>
          <p className="text-[11px] text-zinc-500">
            {formatTime(scrubberTime)} / {formatTime(totalDuration)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-500/30 text-violet-300 hover:bg-violet-500/50"
          >
            {isPlaying ? <Pause className="size-3" /> : <Play className="size-3" />}
          </button>
          <div className="flex items-center gap-1 text-[10px] text-zinc-500">
            {saving || busy ? (
              <span className="inline-flex items-center gap-1 text-violet-300/80">
                <div className="h-2 w-2 animate-spin rounded-full border border-violet-400 border-t-transparent" />
                保存中…
              </span>
            ) : onSave ? (
              <span>编辑自动保存</span>
            ) : null}
          </div>
        </div>
      </header>

      <div
        ref={containerRef}
        className="mb-2 flex h-6 cursor-pointer select-none"
        onClick={handleScrubberClick}
      >
        <div className="relative flex flex-1 overflow-hidden rounded bg-black/30">
          {timeMarkers.map((time) => (
            <div
              key={time}
              className="absolute top-0 bottom-0 w-px bg-white/10"
              style={{ left: `${(time / totalDuration) * 100}%` }}
            >
              <span className="absolute -top-4 left-1 text-[8px] text-zinc-600">
                {formatTime(time)}
              </span>
            </div>
          ))}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-violet-400"
            style={{ left: `${(scrubberTime / totalDuration) * 100}%` }}
          />
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto space-y-2"
        onDragOver={handleDragOver}
      >
        {timeline.map((track) => (
          <div
            key={track.id}
            className="relative rounded-lg border border-white/10 bg-black/25"
            onDrop={(e) => handleDrop(e, track.id)}
          >
            <div className="flex items-center gap-2 border-b border-white/5 px-2 py-1">
              <span
                className={`flex h-3 w-3 rounded-full ${
                  track.type === "video"
                    ? "bg-violet-500"
                    : track.type === "audio_dialogue"
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                }`}
              />
              <span className="text-[10px] font-medium text-zinc-300">
                {TRACK_LABELS[track.type]}
              </span>
              {!readOnly && track.type !== "video" && (
                <button
                  type="button"
                  onClick={() => addClip(track.id)}
                  className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-white/5 text-zinc-500 hover:bg-white/10 hover:text-zinc-300"
                >
                  <Plus className="size-3" />
                </button>
              )}
            </div>

            <div
              className="relative h-14 overflow-x-auto px-2 py-2"
              style={{
                backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 60px, rgba(255,255,255,0.03) 60px, rgba(255,255,255,0.03) 61px)`,
                backgroundSize: `${(60 / totalDuration) * 100}% 100%`,
              }}
            >
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-violet-400/50"
                style={{ left: `${(scrubberTime / totalDuration) * 100}%` }}
              />

              {track.clips.map((clip) => {
                const isSelected = clip.id === selectedClipId;
                const shot = track.type === "video" && clip.sourceId
                  ? project.shots.find((s) => s.id === clip.sourceId)
                  : null;

                return (
                  <div
                    key={clip.id}
                    draggable={!readOnly}
                    onDragStart={(e) =>
                      handleDragStart(e, clip.id, track.id, clip.offsetSec)
                    }
                    onClick={() => !readOnly && setSelectedClipId(clip.id)}
                    className={`absolute top-1 bottom-1 cursor-move rounded border transition ${
                      TRACK_COLORS[track.type]
                    } ${isSelected ? "ring-2 ring-violet-400" : ""} ${
                      dragState?.clipId === clip.id ? "opacity-50" : ""
                    }`}
                    style={{
                      left: `${(clip.offsetSec / totalDuration) * 100}%`,
                      width: `${(clip.durationSec / totalDuration) * 100}%`,
                      minWidth: "40px",
                    }}
                  >
                    <div className="absolute left-1 top-1 flex items-center gap-1">
                      <GripVertical className="size-3 text-white/50" />
                    </div>
                    <div className="flex h-full items-center justify-center px-2">
                      {shot ? (
                        <div className="flex flex-col items-center gap-0.5">
                          {shotThumbnailUrl(shot) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={shotThumbnailUrl(shot)!}
                              alt=""
                              className="h-6 w-auto rounded object-cover"
                            />
                          ) : (
                            <span className="text-[8px] text-white/60">
                              S{shot.order + 1}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[9px] text-white/80 truncate max-w-[60px]">
                          {clip.sourceId ? `对白 ${clip.sourceId.slice(-6)}` : "片段"}
                        </span>
                      )}
                    </div>
                    <div className="absolute right-1 top-1 flex items-center gap-0.5">
                      <span className="text-[7px] text-white/60">
                        {formatTime(clip.durationSec)}
                      </span>
                      {!readOnly && !clip.sourceId && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteClip(clip.id, track.id);
                          }}
                          className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500/50 text-white/70 hover:bg-red-500"
                        >
                          <Trash2 className="size-2" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {selectedClip && (
        <section
          className="mt-2 rounded-lg border border-white/5 bg-black/25 p-3"
          data-testid="drama-timeline-clip-detail"
        >
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-zinc-300">
              选中片段 · {TRACK_LABELS[selectedClip.track.type]}
            </h4>
            {!readOnly && !selectedClip.clip.sourceId && (
              <button
                type="button"
                onClick={() => deleteClip(selectedClip.clip.id, selectedClip.track.id)}
                className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300"
              >
                <Trash2 className="size-3" />
                删除
              </button>
            )}
          </div>
          <dl className="grid gap-2 text-[11px] sm:grid-cols-2">
            <div>
              <dt className="text-zinc-600">位置</dt>
              <dd className="text-zinc-300">{formatTime(selectedClip.clip.offsetSec)}</dd>
            </div>
            <div>
              <dt className="text-zinc-600">时长</dt>
              <dd className="text-zinc-300">{formatTime(selectedClip.clip.durationSec)}</dd>
            </div>
            {selectedClip.track.type !== "video" && (
              <div>
                <dt className="text-zinc-600">音量</dt>
                <dd className="text-zinc-300">
                  {!readOnly ? (
                    <input
                      type="range"
                      min={0}
                      max={2}
                      step={0.1}
                      value={selectedClip.clip.volume}
                      onChange={(e) =>
                        updateClip(selectedClip.clip.id, selectedClip.track.id, {
                          volume: Number(e.target.value),
                        })
                      }
                      className="w-20 accent-violet-500"
                    />
                  ) : (
                    `${Math.round(selectedClip.clip.volume * 100)}%`
                  )}
                </dd>
              </div>
            )}
            {selectedShot && (
              <div className="sm:col-span-2">
                <dt className="text-zinc-600">对应镜头</dt>
                <dd className="text-violet-300/90">
                  S{selectedShot.order + 1} · {shotDialogueLine(selectedShot) || "无对白"}
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}
    </div>
  );
}