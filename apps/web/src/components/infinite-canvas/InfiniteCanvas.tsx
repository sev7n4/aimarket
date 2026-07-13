import React, { useEffect, useRef, useState } from "react";

import {
    isContextMenuClick,
    isEditableTarget,
    RIGHT_PAN_MOVE_THRESHOLD_PX,
    shouldCapturePointerForRightPanCandidate,
    shouldStartPan,
} from "@/lib/canvas-nav";
import { canvasTheme, type CanvasBackgroundMode } from "./canvas-theme";
import type { ViewportTransform } from "./types";

type InfiniteCanvasProps = {
    containerRef: React.RefObject<HTMLDivElement | null>;
    viewport: ViewportTransform;
    backgroundMode?: CanvasBackgroundMode;
    gridVisible?: boolean;
    viewLocked?: boolean;
    onViewportChange: (viewport: ViewportTransform) => void;
    onCanvasMouseDown?: (event: React.PointerEvent<HTMLDivElement>) => void;
    onCanvasDoubleClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
    onCanvasDeselect?: () => void;
    onContextMenu?: (event: React.MouseEvent) => void;
    onDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
    onDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
    children: React.ReactNode;
};

export function InfiniteCanvas({ containerRef, viewport, backgroundMode = "lines", gridVisible = true, viewLocked = false, onViewportChange, onCanvasMouseDown, onCanvasDoubleClick, onCanvasDeselect, onContextMenu, onDragOver, onDrop, children }: InfiniteCanvasProps) {
    const panState = useRef({
        isPanning: false,
        startX: 0,
        startY: 0,
        initialX: 0,
        initialY: 0,
        hasMoved: false,
    });
    const rightDragRef = useRef({
        isActive: false,
        startX: 0,
        startY: 0,
        movedPx: 0,
        suppressMenu: false,
    });
    const scaleRef = useRef(viewport.k);
    const viewportRef = useRef(viewport);
    const frameRef = useRef<number | null>(null);
    const nextViewportRef = useRef<ViewportTransform | null>(null);
    const [isSpacePressed, setIsSpacePressed] = useState(false);

    useEffect(() => {
        scaleRef.current = viewport.k;
        viewportRef.current = viewport;
    }, [viewport.k, viewport.x, viewport.y]);

    useEffect(
        () => () => {
            if (frameRef.current) cancelAnimationFrame(frameRef.current);
        },
        [],
    );

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.code !== "Space") return;
            if (isEditableTarget(event.target)) return;
            event.preventDefault();
            setIsSpacePressed(true);
        };

        const handleKeyUp = (event: KeyboardEvent) => {
            if (event.code === "Space") setIsSpacePressed(false);
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
        };
    }, []);

    const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
        if (viewLocked) return;
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest("[data-canvas-no-zoom],[data-dialog],[data-popover]")) return;

        const delta = -event.deltaY;
        const factor = Math.pow(1.1, delta / 100);
        const newScale = Math.min(Math.max(viewport.k * factor, 0.05), 5);
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        const worldX = (mouseX - viewport.x) / viewport.k;
        const worldY = (mouseY - viewport.y) / viewport.k;

        onViewportChange({
            x: mouseX - worldX * newScale,
            y: mouseY - worldY * newScale,
            k: newScale,
        });
    };

    const startPan = (event: React.PointerEvent<HTMLDivElement>, clientX: number, clientY: number) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        panState.current = {
            isPanning: true,
            startX: clientX,
            startY: clientY,
            initialX: viewport.x,
            initialY: viewport.y,
            hasMoved: false,
        };
        document.body.style.cursor = "grabbing";
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest("[data-canvas-no-zoom]")) return;
        if (target?.closest("[data-connection-create-menu]")) return;
        const isBackgroundClick = !target?.closest("[data-node-id],[data-connection-id]");

        if (event.button === 0 && isBackgroundClick && !isSpacePressed) {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            onCanvasMouseDown?.(event);
            return;
        }

        if (viewLocked) return;

        if (
            shouldStartPan({
                spacePressed: isSpacePressed,
                button: event.button,
                rightDragMoved: false,
            }) &&
            (event.button === 1 || isBackgroundClick)
        ) {
            startPan(event, event.clientX, event.clientY);
            return;
        }

        if (shouldCapturePointerForRightPanCandidate(event.button, isBackgroundClick)) {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            rightDragRef.current = {
                isActive: true,
                startX: event.clientX,
                startY: event.clientY,
                movedPx: 0,
                suppressMenu: false,
            };
        }
    };

    useEffect(() => {
        const handlePointerMove = (event: PointerEvent) => {
            if (viewLocked) return;
            if (rightDragRef.current.isActive && !panState.current.isPanning) {
                const dx = event.clientX - rightDragRef.current.startX;
                const dy = event.clientY - rightDragRef.current.startY;
                const movedPx = Math.max(Math.abs(dx), Math.abs(dy));
                rightDragRef.current.movedPx = movedPx;

                if (
                    shouldStartPan({
                        spacePressed: false,
                        button: 2,
                        rightDragMoved: movedPx >= RIGHT_PAN_MOVE_THRESHOLD_PX,
                    })
                ) {
                    rightDragRef.current.suppressMenu = true;
                    panState.current = {
                        isPanning: true,
                        startX: event.clientX,
                        startY: event.clientY,
                        initialX: viewportRef.current.x,
                        initialY: viewportRef.current.y,
                        hasMoved: true,
                    };
                    document.body.style.cursor = "grabbing";
                }
            }

            if (!panState.current.isPanning) return;

            const dx = event.clientX - panState.current.startX;
            const dy = event.clientY - panState.current.startY;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                panState.current.hasMoved = true;
            }

            nextViewportRef.current = {
                x: panState.current.initialX + dx,
                y: panState.current.initialY + dy,
                k: scaleRef.current,
            };
            if (frameRef.current) return;
            frameRef.current = requestAnimationFrame(() => {
                frameRef.current = null;
                if (nextViewportRef.current) onViewportChange(nextViewportRef.current);
            });
        };

        const handlePointerUp = () => {
            if (rightDragRef.current.isActive) {
                if (!isContextMenuClick(rightDragRef.current.movedPx)) {
                    rightDragRef.current.suppressMenu = true;
                }
                rightDragRef.current.isActive = false;
            }

            if (!panState.current.isPanning) return;

            if (!panState.current.hasMoved) {
                onCanvasDeselect?.();
            }
            panState.current.isPanning = false;
            document.body.style.cursor = "default";
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
        };
    }, [onCanvasDeselect, onViewportChange, viewLocked]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const preventWheelScroll = (event: WheelEvent) => event.preventDefault();
        container.addEventListener("wheel", preventWheelScroll, { passive: false });
        return () => container.removeEventListener("wheel", preventWheelScroll);
    }, [containerRef]);

    const handleContextMenu = (event: React.MouseEvent) => {
        if (rightDragRef.current.suppressMenu) {
            event.preventDefault();
            rightDragRef.current.suppressMenu = false;
            return;
        }
        onContextMenu?.(event);
    };

    return (
        <div
            ref={containerRef}
            className="relative h-full w-full cursor-grab select-none overflow-hidden"
            style={{ background: canvasTheme.canvas.background }}
            onPointerDown={handlePointerDown}
            onDoubleClick={(event) => {
                const target = event.target instanceof Element ? event.target : null;
                if (target?.closest("[data-node-id],[data-connection-id],[data-connection-create-menu]")) {
                    return;
                }
                onCanvasDoubleClick?.(event);
            }}
            onWheel={handleWheel}
            onContextMenu={handleContextMenu}
            onDragOver={(event) => {
                event.preventDefault();
                onDragOver?.(event);
            }}
            onDrop={onDrop}
        >
            <CanvasGrid viewport={viewport} mode={gridVisible ? backgroundMode : "blank"} />
            <div
                className="absolute origin-top-left"
                style={{
                    transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.k})`,
                }}
            >
                {children}
            </div>
        </div>
    );
}

function CanvasGrid({ viewport, mode }: { viewport: ViewportTransform; mode: CanvasBackgroundMode }) {
    if (mode === "blank") return null;

    const gridSize = 48 * viewport.k;
    const x = viewport.x % gridSize;
    const y = viewport.y % gridSize;
    const dotSize = viewport.k < 0.12 ? 0.8 : 1.15;
    const backgroundImage =
        mode === "dots" ? `radial-gradient(circle, ${canvasTheme.canvas.dot} ${dotSize}px, transparent ${dotSize + 0.2}px)` : `linear-gradient(${canvasTheme.canvas.line} 1px, transparent 1px), linear-gradient(90deg, ${canvasTheme.canvas.line} 1px, transparent 1px)`;

    return (
        <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
                backgroundImage,
                backgroundSize: `${gridSize}px ${gridSize}px`,
                backgroundPosition: `${x}px ${y}px`,
            }}
        />
    );
}
