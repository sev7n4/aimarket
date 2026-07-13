"use client";

import { Compass, Focus, HelpCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { canvasTheme } from "./canvas-theme";
import { INFINITE_ZOOM_BAR_HEIGHT, infiniteZoomControlsBottom } from "./infinite-canvas-layout";

type CanvasZoomControlsProps = {
    scale: number;
    onScaleChange: (scale: number) => void;
    onReset: () => void;
    isMiniMapOpen: boolean;
    onToggleMiniMap: () => void;
    bottomInsetPx?: number;
};

export function CanvasZoomControls({ scale, onScaleChange, onReset, isMiniMapOpen, onToggleMiniMap, bottomInsetPx = 0 }: CanvasZoomControlsProps) {
    const [shortcutsOpen, setShortcutsOpen] = useState(false);
    const dialogRef = useRef<HTMLDialogElement>(null);
    const dockStyle = { background: canvasTheme.toolbar.panel, borderColor: canvasTheme.toolbar.border, color: canvasTheme.toolbar.item, boxShadow: "0 12px 32px rgba(0,0,0,.28)" };
    const activeStyle = { background: canvasTheme.toolbar.activeBg, color: canvasTheme.toolbar.activeText };

    const openShortcuts = useCallback(() => {
        setShortcutsOpen(true);
        dialogRef.current?.showModal();
    }, []);

    const closeShortcuts = useCallback(() => {
        setShortcutsOpen(false);
        dialogRef.current?.close();
    }, []);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const handleCancel = (e: Event) => {
            e.preventDefault();
            closeShortcuts();
        };
        dialog.addEventListener("cancel", handleCancel);
        return () => dialog.removeEventListener("cancel", handleCancel);
    }, [closeShortcuts]);

    return (
        <div
            className="absolute right-4 z-50"
            style={{ bottom: infiniteZoomControlsBottom(bottomInsetPx) }}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
        >
            <div className="flex items-center gap-0.5 rounded-lg border px-1.5 shadow-lg backdrop-blur" style={{ ...dockStyle, height: INFINITE_ZOOM_BAR_HEIGHT }}>
                <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:opacity-80"
                    style={isMiniMapOpen ? activeStyle : { color: canvasTheme.toolbar.item }}
                    onClick={onToggleMiniMap}
                    title={isMiniMapOpen ? "关闭小地图" : "打开小地图"}
                    aria-label={isMiniMapOpen ? "关闭小地图" : "打开小地图"}
                >
                    <Compass className="size-3.5" />
                </button>
                <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:opacity-80"
                    style={{ color: canvasTheme.toolbar.item }}
                    onClick={onReset}
                    title="重置视图"
                    aria-label="重置视图"
                    data-testid="canvas-reset-view"
                >
                    <Focus className="size-3.5" />
                </button>
                <span title="放大/缩小画布" className="flex items-center">
                    <input
                        type="range"
                        min="5"
                        max="500"
                        step="1"
                        value={Math.round(scale * 100)}
                        className="w-16"
                        style={{ accentColor: canvasTheme.node.activeStroke }}
                        onChange={(event) => onScaleChange(Number(event.target.value) / 100)}
                        aria-label="放大/缩小画布"
                    />
                </span>
                <span className="w-8 text-right text-[10px] tabular-nums" style={{ color: canvasTheme.node.muted }}>
                    {Math.round(scale * 100)}%
                </span>
                <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:opacity-80"
                    style={shortcutsOpen ? activeStyle : { color: canvasTheme.toolbar.item }}
                    onClick={openShortcuts}
                    title="快捷键"
                    aria-label="快捷键"
                >
                    <HelpCircle className="size-3.5" />
                </button>
            </div>
            <dialog
                ref={dialogRef}
                className="rounded-xl border p-0 shadow-2xl backdrop:bg-black/50"
                style={{ background: canvasTheme.toolbar.panel, borderColor: canvasTheme.toolbar.border, color: canvasTheme.node.text }}
                onClick={(e) => {
                    if (e.target === dialogRef.current) closeShortcuts();
                }}
            >
                <div className="px-6 pb-2 pt-4 text-base font-semibold">快捷键</div>
                <div className="space-y-3 border-t px-6 pb-5 pt-4 text-sm" style={{ borderColor: canvasTheme.node.stroke }}>
                    <Shortcut label="拖动画布" value="平移视图" />
                    <Shortcut label="滚轮" value="缩放画布" />
                    <Shortcut label="Ctrl / Cmd + 拖动" value="框选多个节点" />
                    <Shortcut label="Shift / Ctrl / Cmd + 点击" value="追加选择节点" />
                    <Shortcut label="Ctrl / Cmd + C / V" value="复制 / 粘贴节点" />
                    <Shortcut label="Delete / Backspace" value="删除选中" />
                </div>
                <div className="flex justify-end border-t px-6 py-3" style={{ borderColor: canvasTheme.node.stroke }}>
                    <button
                        type="button"
                        className="rounded-md px-4 py-1.5 text-sm transition-colors hover:opacity-80"
                        style={{ background: canvasTheme.toolbar.activeBg, color: canvasTheme.toolbar.activeText }}
                        onClick={closeShortcuts}
                    >
                        关闭
                    </button>
                </div>
            </dialog>
        </div>
    );
}

function Shortcut({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-4">
            <span className="text-base font-medium">{label}</span>
            <span className="opacity-60">{value}</span>
        </div>
    );
}
